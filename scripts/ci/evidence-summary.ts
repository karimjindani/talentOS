/**
 * The single GitHub step summary for the `e2e-evidence` job (`v0.20.13`, D-112).
 *
 * Replaces `regression-summary.ts` and `journey-report.ts`, which wrote two unrelated blocks — one
 * counting scenarios, one counting journey steps — with no way to tell whether a given business
 * process was healthy. This writes one roll-up keyed on the same 5 processes the PDFs use, then the
 * detail, so the PR page and the artifact tell the same story.
 *
 * Non-throwing, like everything else in this directory: it runs under `if: always()`, including
 * when the stack failed to boot and neither input exists. The scenario and journey steps own the
 * job's exit code.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { emit, escapePipes, isCliEntrypoint, newestResultFile, seconds } from "../lib/ci-helpers";
import { PLATFORM, PROCESSES, isScope, type Scope } from "../lib/evidence-taxonomy";

type StepRecord = {
  index: number;
  name: string;
  actor: string;
  process?: string;
  proves: string;
  status: "passed" | "failed";
  durationMs: number;
  screenshot: string | null;
  error?: string;
};

export type JourneyRecord = {
  journey: string;
  runId: string;
  startedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  steps: StepRecord[];
};

type ScenarioResult = {
  id?: string;
  area: string;
  scopes?: string[];
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  detail?: string;
  error?: string;
};

type RegressionPayload = {
  runId?: string;
  summary?: { area?: string; total?: number; passed?: number; failed?: number; skipped?: number; durationMs?: number };
  results?: ScenarioResult[];
};

const RESULTS_DIR = resolve(process.argv[2] ?? join(".ops", "journey-results"));
const REGRESSION_DIR = resolve(process.argv[3] ?? join(".ops", "regression-results"));

const ICON: Record<ScenarioResult["status"], string> = { passed: "✅", failed: "❌", skipped: "⏭️" };
const ORDER: Record<ScenarioResult["status"], number> = { failed: 0, skipped: 1, passed: 2 };

/**
 * One journey's step table.
 *
 * Column order (index, actor, step, proves, result, evidence) is pinned by test and by habit — the
 * "Proves" column is the reason this table is worth reading at all, so it sits next to the step it
 * qualifies rather than at the end.
 */
export function renderJourneyMarkdown(record: JourneyRecord): string {
  const verdict = record.status === "failed" ? "❌ **Failed**" : "✅ **Passed**";
  const passed = record.steps.filter((step) => step.status === "passed").length;

  const lines: string[] = [
    `## Journey: ${record.journey}`,
    "",
    `${verdict} — ${passed}/${record.steps.length} steps · ${seconds(record.durationMs)}`,
    "",
    `Run \`${record.runId}\` · started ${record.startedAt}`,
    "",
    "| # | Actor | Step | Proves | Result | Evidence |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const step of record.steps) {
    const result = step.status === "passed" ? `✅ ${seconds(step.durationMs)}` : "❌ failed";
    const evidence = step.screenshot ? `\`${step.screenshot}\`` : "—";
    lines.push(
      `| ${step.index} | ${step.actor} | ${escapePipes(step.name)} | ${escapePipes(step.proves)} | ${result} | ${evidence} |`
    );
  }

  const failures = record.steps.filter((step) => step.status === "failed");
  if (failures.length > 0) {
    lines.push("", "### Failures", "");
    for (const step of failures) {
      lines.push(`**${step.index}. ${escapePipes(step.name)}**`, "", "```", (step.error ?? "no error text").trim(), "```", "");
    }
  }

  return lines.join("\n");
}

/**
 * The roll-up that ties the two evidence layers together — the thing neither old summary could say.
 * One row per business process, counting both its journey steps and its scoped scenario checks.
 */
export function renderProcessRollup(records: JourneyRecord[], scenarios: ScenarioResult[]): string {
  const stepsBy = new Map<string, StepRecord[]>();
  for (const name of PROCESSES) stepsBy.set(name, []);
  for (const record of records) {
    for (const step of record.steps) stepsBy.get(step.process ?? "")?.push(step);
  }

  const scenariosBy = new Map<Scope, ScenarioResult[]>();
  for (const name of PROCESSES) scenariosBy.set(name, []);
  scenariosBy.set(PLATFORM, []);
  for (const result of scenarios) {
    for (const scope of result.scopes ?? []) {
      if (isScope(scope)) scenariosBy.get(scope)?.push(result);
    }
  }

  const lines: string[] = [
    "### Coverage by business process",
    "",
    "| Process | Journey steps | Scenario checks | Failed |",
    "| --- | --- | --- | --- |"
  ];

  for (const name of [...PROCESSES, PLATFORM]) {
    const steps = stepsBy.get(name) ?? [];
    const checks = scenariosBy.get(name as Scope) ?? [];
    const failed =
      steps.filter((step) => step.status === "failed").length +
      checks.filter((check) => check.status === "failed").length;
    const stepCell = name === PLATFORM ? "—" : `${steps.filter((s) => s.status === "passed").length}/${steps.length}`;
    const checkCell = `${checks.filter((c) => c.status === "passed").length}/${checks.length}`;
    lines.push(`| ${escapePipes(name)} | ${stepCell} | ${checkCell} | ${failed === 0 ? "—" : `❌ ${failed}`} |`);
  }

  lines.push("", "Each process has its own complete PDF in the **e2e-evidence** artifact.");
  return lines.join("\n");
}

function loadRecords(): JourneyRecord[] {
  if (!existsSync(RESULTS_DIR)) return [];
  const files = readdirSync(RESULTS_DIR).filter((name) => name.endsWith(".json") && name !== "playwright.json");
  const records: JourneyRecord[] = [];
  for (const file of files) {
    try {
      records.push(JSON.parse(readFileSync(join(RESULTS_DIR, file), "utf8")) as JourneyRecord);
    } catch (error) {
      process.stdout.write(`Could not parse ${file}, skipping it in the summary: ${String(error)}\n`);
    }
  }
  return records;
}

function renderScenarioSection(payload: RegressionPayload | null, parseError: string | null): string {
  if (parseError) return `## E2E scenario evidence\n\n⚠️ ${parseError}`;
  if (!payload) {
    return (
      "## E2E scenario evidence\n\n" +
      "⚠️ **No regression result file was produced.**\n\n" +
      `Nothing matched \`${REGRESSION_DIR}/*.json\`, which usually means the stack failed to boot ` +
      "before the suite ran. Check the bootstrap step's log and the uploaded Docker logs."
    );
  }

  const results = payload.results ?? [];
  const s = payload.summary ?? {};
  const total = s.total ?? results.length;
  const passed = s.passed ?? results.filter((r) => r.status === "passed").length;
  const failed = s.failed ?? results.filter((r) => r.status === "failed").length;
  const skipped = s.skipped ?? results.filter((r) => r.status === "skipped").length;
  const verdict = failed > 0 ? "❌ **Failed**" : "✅ **Passed**";

  const lines: string[] = [
    "## E2E scenario evidence",
    "",
    `${verdict} — ${passed}/${total} passed · ${failed} failed · ${skipped} skipped` +
      (s.durationMs ? ` · ${seconds(s.durationMs)}` : ""),
    "",
    `Run \`${payload.runId ?? "unknown"}\` · area \`${s.area ?? "all"}\``,
    ""
  ];

  const failures = results.filter((r) => r.status === "failed");
  if (failures.length > 0) {
    lines.push("### Failures", "");
    for (const f of failures) {
      lines.push(
        `**${escapePipes(f.id ?? f.name)}** ${escapePipes(f.name)} _(${f.area})_`,
        "",
        "```",
        (f.error ?? "no error text").trim(),
        "```",
        ""
      );
    }
  }

  lines.push("### All scenarios", "", "| | TC ID | Area | Scenario | Time |", "| --- | --- | --- | --- | --- |");
  for (const r of [...results].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.area.localeCompare(b.area))) {
    lines.push(`| ${ICON[r.status]} | \`${r.id ?? "—"}\` | ${r.area} | ${escapePipes(r.name)} | ${seconds(r.durationMs)} |`);
  }

  const skips = results.filter((r) => r.status === "skipped");
  if (skips.length > 0) {
    lines.push("", "### Skipped", "");
    for (const r of skips) {
      lines.push(`- **${escapePipes(r.name)}** _(${r.area})_ — ${escapePipes(r.error ?? "no reason given")}`);
    }
  }

  return lines.join("\n");
}

function main(): void {
  const records = loadRecords();

  let payload: RegressionPayload | null = null;
  let parseError: string | null = null;
  const regressionFile = newestResultFile(REGRESSION_DIR);
  if (regressionFile) {
    try {
      payload = JSON.parse(readFileSync(regressionFile, "utf8")) as RegressionPayload;
    } catch (error) {
      parseError = `Could not parse \`${regressionFile}\`: ${String(error)}`;
    }
  }

  emit(renderScenarioSection(payload, parseError));
  emit(renderProcessRollup(records, payload?.results ?? []));

  if (records.length === 0) {
    emit(
      "## Journey evidence\n\n" +
        "⚠️ **No journey result files were produced.**\n\n" +
        `Nothing matched \`${RESULTS_DIR}/*.json\`. The browser suite either did not run or died ` +
        "before its first step — check the uploaded Docker logs."
    );
    return;
  }

  for (const record of records) emit(renderJourneyMarkdown(record));

  emit(
    "\n---\n\nOne complete PDF per business process, the full results JSON and every captured " +
      "screenshot are attached to this run as the **e2e-evidence** artifact."
  );
}

if (isCliEntrypoint(import.meta.url)) {
  main();
}
