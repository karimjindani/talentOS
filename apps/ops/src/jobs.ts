import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { OpsJob, OpsJobKind, OpsJobStatus } from "@talentos/auth";
import { OPS_RUNS_DIR } from "./config";
import { formatCommand, getCommandsForJob, isAllowedCommand } from "./commands";
import { runCommand } from "./process";

const jobs = new Map<string, OpsJob>();

export async function createJob(kind: OpsJobKind): Promise<OpsJob> {
  const commands = getCommandsForJob(kind);
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

  const commands = getCommandsForJob(job.kind);
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
