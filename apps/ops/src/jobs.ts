import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type {
  OpsJob,
  OpsJobKind,
  OpsJobStatus,
  RegressionArea,
  RegressionScenarioResult,
  RegressionSummary
} from "@talentos/auth";
import { OPS_RUNS_DIR } from "./config";
import { formatCommand, getCommandsForJob, isAllowedCommand } from "./commands";
import { runCommand } from "./process";

const jobs = new Map<string, OpsJob>();
const SCENARIO_AREAS: readonly Exclude<RegressionArea, "all">[] = [
  "unit",
  "auth",
  "applicant",
  "admin",
  "programs",
  "missions",
  "journal",
  "tenant",
  "dashboard",
  "storage",
  "ops"
];

export async function createJob(kind: OpsJobKind, area: RegressionArea = "all"): Promise<OpsJob> {
  const commands = getCommandsForJob(kind, area);
  if (!commands) {
    throw new Error(`Unknown job kind: ${kind}`);
  }

  for (const spec of commands) {
    if (!isAllowedCommand(spec.command, spec.args)) {
      throw new Error(`Command is not allowed: ${formatCommand(spec)}`);
    }
  }

  const now = new Date().toISOString();
  const job: OpsJob = {
    id: randomUUID(),
    kind,
    ...(kind === "regression" ? { area } : {}),
    status: "queued",
    startedAt: now,
    updatedAt: now,
    steps: commands.map((spec) => ({
      id: spec.id,
      name: spec.name,
      command: formatCommand(spec),
      status: "queued",
      output: ""
    })),
    output: ""
  };

  jobs.set(job.id, job);
  await saveJob(job);
  void runJob(job);
  return job;
}

export async function getJob(id: string): Promise<OpsJob | null> {
  const active = jobs.get(id);
  if (active) return active;

  try {
    const content = await readFile(jobPath(id), "utf8");
    return JSON.parse(content) as OpsJob;
  } catch {
    return null;
  }
}

export function summarizeStepStatus(exitCode: number | null, timedOut: boolean): OpsJobStatus {
  if (timedOut || exitCode !== 0) return "failed";
  return "passed";
}

async function runJob(job: OpsJob) {
  job.status = "running";
  touch(job);
  await saveJob(job);

  const commands = getCommandsForJob(job.kind, job.area ?? "all");
  for (let index = 0; index < commands.length; index += 1) {
    const spec = commands[index];
    const step = job.steps[index];
    step.status = "running";
    step.startedAt = new Date().toISOString();
    touch(job);
    await saveJob(job);

    const result = await runCommand(spec.command, spec.args, spec.timeoutMs);
    step.output = result.output;
    step.exitCode = result.exitCode;
    step.durationMs = result.durationMs;
    step.completedAt = new Date().toISOString();
    step.status = summarizeStepStatus(result.exitCode, result.timedOut);
    step.regressionSummary = parseRegressionSummary(result.output);
    step.regressionSummaries = parseRegressionSummaries(result.output);
    step.regressionScenarios = parseRegressionScenarioResults(result.output);
    if (step.regressionSummary) {
      job.regressionSummary = mergeRegressionSummaries(job.area ?? step.regressionSummary.area, [
        ...(job.regressionSummary ? [job.regressionSummary] : []),
        step.regressionSummary
      ]);
    }
    if (step.regressionSummaries?.length) {
      job.regressionSummaries = mergeRegressionSummariesByArea([
        ...(job.regressionSummaries ?? []),
        ...step.regressionSummaries
      ]);
    }
    if (step.regressionScenarios?.length) {
      job.regressionScenarios = [...(job.regressionScenarios ?? []), ...step.regressionScenarios];
    }
    job.output += `\n$ ${step.command}\n${result.output}`;

    if (step.status === "failed") {
      job.status = "failed";
      job.error = `${step.name} failed.`;
      job.completedAt = new Date().toISOString();
      touch(job);
      await saveJob(job);
      return;
    }
    touch(job);
    await saveJob(job);
  }

  job.status = "passed";
  job.completedAt = new Date().toISOString();
  touch(job);
  await saveJob(job);
}

export function parseRegressionSummary(output: string): RegressionSummary | undefined {
  return parseRegressionPayload(output)?.summary;
}

export function parseRegressionSummaries(output: string): RegressionSummary[] | undefined {
  const payload = parseRegressionPayload(output);
  if (!payload) return undefined;
  if (!payload.results?.length) return payload.summary ? [payload.summary] : undefined;

  const scenarioResults = payload.results.filter(
    (result): result is RegressionScenarioResult => isRegressionScenarioResult(result)
  );

  return mergeRegressionSummariesByArea(
    scenarioResults.map((result) => ({
      area: result.area,
      total: 1,
      passed: result.status === "passed" ? 1 : 0,
      failed: result.status === "failed" ? 1 : 0,
      skipped: result.status === "skipped" ? 1 : 0,
      durationMs: result.durationMs
    }))
  );
}

export function parseRegressionScenarioResults(output: string): RegressionScenarioResult[] | undefined {
  const payload = parseRegressionPayload(output);
  if (!payload?.results?.length) return undefined;

  return payload.results
    .filter((result): result is RegressionScenarioResult => isRegressionScenarioResult(result))
    .map((result) => ({
      area: result.area,
      name: result.name,
      status: result.status,
      durationMs: result.durationMs,
      ...(typeof result.detail === "string" ? { detail: result.detail } : {}),
      ...(typeof result.error === "string" ? { error: result.error } : {})
    }));
}

type RegressionResultPayload = {
  summary?: RegressionSummary;
  results?: unknown[];
};

function parseRegressionPayload(output: string): RegressionResultPayload | undefined {
  const line = output
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith("REGRESSION_RESULT_JSON:"));
  if (!line) return undefined;
  try {
    return JSON.parse(line.slice("REGRESSION_RESULT_JSON:".length)) as RegressionResultPayload;
  } catch {
    return undefined;
  }
}

function isRegressionScenarioResult(value: unknown): value is RegressionScenarioResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RegressionScenarioResult>;
  return (
    SCENARIO_AREAS.includes(candidate.area as Exclude<RegressionArea, "all">) &&
    typeof candidate.name === "string" &&
    ["passed", "failed", "skipped"].includes(String(candidate.status)) &&
    typeof candidate.durationMs === "number"
  );
}

function mergeRegressionSummaries(area: RegressionArea, summaries: RegressionSummary[]): RegressionSummary {
  return summaries.reduce<RegressionSummary>(
    (merged, summary) => ({
      area,
      total: merged.total + summary.total,
      passed: merged.passed + summary.passed,
      failed: merged.failed + summary.failed,
      skipped: merged.skipped + summary.skipped,
      durationMs: merged.durationMs + summary.durationMs
    }),
    { area, total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 }
  );
}

function mergeRegressionSummariesByArea(summaries: RegressionSummary[]): RegressionSummary[] {
  const merged = new Map<RegressionArea, RegressionSummary>();
  for (const summary of summaries) {
    const current = merged.get(summary.area) ?? {
      area: summary.area,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0
    };
    merged.set(summary.area, {
      area: summary.area,
      total: current.total + summary.total,
      passed: current.passed + summary.passed,
      failed: current.failed + summary.failed,
      skipped: current.skipped + summary.skipped,
      durationMs: current.durationMs + summary.durationMs
    });
  }
  return [...merged.values()];
}

function touch(job: OpsJob) {
  job.updatedAt = new Date().toISOString();
}

async function saveJob(job: OpsJob) {
  await mkdir(OPS_RUNS_DIR, { recursive: true });
  await writeFile(jobPath(job.id), `${JSON.stringify(job, null, 2)}\n`, "utf8");
}

function jobPath(id: string) {
  return resolve(OPS_RUNS_DIR, `${id}.json`);
}
