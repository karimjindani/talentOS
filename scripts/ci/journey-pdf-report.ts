/**
 * Renders one complete PDF per named business process (`v0.20.5`, merged with scenario evidence in
 * `v0.20.13`/D-112) — not one combined report, and no longer journey steps alone.
 *
 * Each report now carries both evidence layers for its process:
 *
 *   1. a TC-ID test case sheet built from `scripts/regression/run.ts`'s scoped scenario results,
 *   2. the journey step cards with their live screenshots,
 *   3. a failures-and-detail appendix,
 *   4. what the process is known not to cover.
 *
 * Journey steps carry a `process` tag (`scripts/lib/evidence-taxonomy.ts`'s `PROCESSES`) and
 * regression scenarios carry `scopes` naming the same processes, which is what lets the two be
 * joined at all — before `v0.20.13` there was no key between them.
 *
 * `docs-only.spec.ts` does not use the `journey` fixture and writes no JSON here at all — it has
 * no "process", being a documentation screenshot sweep rather than a business process — so it
 * never appears in these reports.
 *
 * Same non-throwing contract as `evidence-summary.ts`: this runs with `if: always()`, including
 * when the stack failed to boot and one or both evidence sources are missing. The test and journey
 * steps own the pass/fail exit code; a crash here must not replace a real failure with a confusing
 * one. Every combination of present/absent inputs still exits 0 — see `main()`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  escapeHtml,
  formatTimestamp,
  isCliEntrypoint,
  newestResultFile,
  seconds,
  slugify
} from "../lib/ci-helpers";
import {
  KNOWN_GAPS,
  PLATFORM,
  PLATFORM_DESCRIPTION,
  PROCESS_DESCRIPTIONS,
  PROCESSES,
  isScope,
  type Process,
  type Scope
} from "../lib/evidence-taxonomy";

export type StepRecord = {
  index: number;
  name: string;
  actor: string;
  process: string;
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

/**
 * One regression scenario's outcome, as written by `scripts/regression/run.ts`.
 *
 * `id` and `scopes` arrive from `v0.20.13` onward. They are optional here because this script must
 * still render an older result file — a re-run of a historical artifact should degrade to "no
 * sheet", not crash.
 */
export type ScenarioResult = {
  id?: string;
  area: string;
  scopes?: string[];
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  detail?: string;
  error?: string;
};

export type RegressionPayload = {
  runId?: string;
  summary?: { area?: string; total?: number; passed?: number; failed?: number; skipped?: number; durationMs?: number };
  results?: ScenarioResult[];
};

const RESULTS_DIR = resolve(process.argv[2] ?? join(".ops", "journey-results"));
const EVIDENCE_DIR = resolve(process.argv[3] ?? join(".ops", "journey-evidence"));
const REPORT_DIR = resolve(process.argv[4] ?? join(".ops", "journey-report"));
const REGRESSION_DIR = resolve(process.argv[5] ?? join(".ops", "regression-results"));

/** Failures first, then skips, then passes — a reader should hit the bad news without scrolling. */
const STATUS_ORDER: Record<ScenarioResult["status"], number> = { failed: 0, skipped: 1, passed: 2 };

/** Resolves a step's screenshot to an embeddable data URI, or null when there is none to embed. */
export type ScreenshotResolver = (journey: string, runId: string, filename: string) => string | null;

type FlatStep = { record: JourneyRecord; step: StepRecord };

export function flattenSteps(records: JourneyRecord[]): FlatStep[] {
  const flat: FlatStep[] = [];
  for (const record of records) {
    for (const step of record.steps) flat.push({ record, step });
  }
  return flat;
}

/** Steps whose `process` doesn't match any known name are dropped, not silently miscategorized. */
export function groupByProcess(flat: FlatStep[]): Map<Process, FlatStep[]> {
  const groups = new Map<Process, FlatStep[]>();
  for (const name of PROCESSES) groups.set(name, []);
  for (const item of flat) {
    const bucket = groups.get(item.step.process as Process);
    if (bucket) bucket.push(item);
  }
  return groups;
}

/**
 * Buckets scenario results by the scopes they declare. A scenario may name more than one — the
 * tenant-isolation check that guards both the public directory and recruiter grants belongs in
 * both reports — so this is not a partition.
 *
 * Untagged results (a pre-`v0.20.13` file) land nowhere rather than being guessed into a process.
 */
export function groupByScope(results: ScenarioResult[]): Map<Scope, ScenarioResult[]> {
  const groups = new Map<Scope, ScenarioResult[]>();
  for (const name of PROCESSES) groups.set(name, []);
  groups.set(PLATFORM, []);
  for (const result of results) {
    for (const scope of result.scopes ?? []) {
      if (!isScope(scope)) continue;
      groups.get(scope)?.push(result);
    }
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.id ?? "").localeCompare(b.id ?? ""));
  }
  return groups;
}

export type ProcessReportInput = {
  process: Process;
  index: number;
  total: number;
  steps: FlatStep[];
  /** Regression rows scoped to this process. */
  scenarios: ScenarioResult[];
  /** Platform rows, repeated verbatim in every report so each file stands alone. */
  platform: ScenarioResult[];
  gaps: readonly string[];
  regressionRunId: string | null;
  /** True when no journey result file existed at all — distinct from "this process had no steps". */
  journeyEvidenceMissing: boolean;
  /** True when no regression result file existed at all. */
  regressionEvidenceMissing: boolean;
  generatedAt?: Date;
};

function renderStat(value: string, label: string, tone: "" | "pass" | "fail" = ""): string {
  return `<div class="stat ${tone}"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

function renderActorPill(actor: string): string {
  return `<span class="pill actor-${escapeHtml(actor)}">${escapeHtml(actor)}</span>`;
}

function renderStepCard(item: FlatStep, resolveScreenshot: ScreenshotResolver): string {
  const { record, step } = item;
  const resultClass = step.status === "passed" ? "pass" : "fail";
  const resultLabel = step.status === "passed" ? `Passed · ${seconds(step.durationMs)}` : "Failed";
  const screenshotDataUri = step.screenshot ? resolveScreenshot(record.journey, record.runId, step.screenshot) : null;

  const body =
    step.status === "failed"
      ? `<pre class="error">${escapeHtml(step.error ?? "no error text")}</pre>`
      : screenshotDataUri
        ? `<img src="${screenshotDataUri}" alt="${escapeHtml(step.name)}" />`
        : `<p class="missing">No screenshot was captured for this step.</p>`;

  return `<article class="step-card ${resultClass}">
    <header>
      <span class="step-index">${step.index}</span>
      <h3>${escapeHtml(step.name)}</h3>
      ${renderActorPill(step.actor)}
      <span class="badge ${resultClass}">${escapeHtml(resultLabel)}</span>
    </header>
    <p class="proves"><strong>Proves:</strong> ${escapeHtml(step.proves)}</p>
    ${body}
  </article>`;
}

function statusBadge(status: ScenarioResult["status"]): string {
  const cls = status === "passed" ? "pass" : status === "failed" ? "fail" : "skip";
  const label = status === "passed" ? "Pass" : status === "failed" ? "Fail" : "Skip";
  return `<span class="badge ${cls}">${label}</span>`;
}

/** The test case sheet — the table a reviewer reads and nothing else when the run is green. */
function renderSheet(rows: ScenarioResult[], emptyNote: string): string {
  if (rows.length === 0) return `<p class="missing">${escapeHtml(emptyNote)}</p>`;

  const body = rows
    .map(
      (row) => `<tr>
      <td class="tcid">${escapeHtml(row.id ?? "—")}</td>
      <td>${escapeHtml(row.area)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${statusBadge(row.status)}</td>
      <td class="num">${escapeHtml(seconds(row.durationMs))}</td>
    </tr>`
    )
    .join("\n");

  return `<table class="sheet">
    <thead><tr><th>TC ID</th><th>Area</th><th>Scenario — expected result</th><th>Result</th><th>Time</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

/**
 * Failure text and the `detail` strings passed scenarios return (e.g. the computed Thursday
 * deadline). The reference report's raw request/response log section, in this repo's terms.
 */
function renderAppendix(steps: FlatStep[], scenarios: ScenarioResult[]): string {
  const blocks: string[] = [];

  for (const { step } of steps.filter((item) => item.step.status === "failed")) {
    blocks.push(
      `<div class="entry"><h4>Step ${step.index} — ${escapeHtml(step.name)}</h4><pre class="error">${escapeHtml(
        step.error ?? "no error text"
      )}</pre></div>`
    );
  }

  for (const row of scenarios.filter((item) => item.status === "failed")) {
    blocks.push(
      `<div class="entry"><h4>${escapeHtml(row.id ?? row.area)} — ${escapeHtml(row.name)}</h4><pre class="error">${escapeHtml(
        row.error ?? "no error text"
      )}</pre></div>`
    );
  }

  const details = scenarios.filter((row) => row.status === "passed" && row.detail);
  if (details.length > 0) {
    const items = details
      .map((row) => `<li><code>${escapeHtml(row.id ?? row.area)}</code> — ${escapeHtml(row.detail as string)}</li>`)
      .join("");
    blocks.push(`<div class="entry"><h4>Recorded scenario detail</h4><ul class="detail-list">${items}</ul></div>`);
  }

  if (blocks.length === 0) return `<p class="missing">Nothing failed and no scenario recorded extra detail.</p>`;
  return blocks.join("\n");
}

function renderGaps(gaps: readonly string[], skipped: ScenarioResult[]): string {
  const items: string[] = [];
  for (const row of skipped) {
    items.push(
      `<li><strong>Skipped:</strong> ${escapeHtml(row.name)} <em>(${escapeHtml(row.area)})</em> — ${escapeHtml(
        row.error ?? "no reason given"
      )}</li>`
    );
  }
  for (const gap of gaps) items.push(`<li>${escapeHtml(gap)}</li>`);
  if (items.length === 0) return `<p class="missing">No gaps are recorded for this process.</p>`;
  return `<ul class="gap-list">${items.join("")}</ul>`;
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px 40px; font-size: 12px; }
  .eyebrow { display: inline-block; color: #2563eb; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  h1 { font-size: 26px; margin: 6px 0 4px; color: #1e3a8a; }
  .description { color: #475569; margin: 0 0 4px; max-width: 640px; }
  .meta { color: #94a3b8; margin: 0 0 16px; font-size: 11px; }
  .stat-row { display: flex; gap: 12px; margin: 16px 0; }
  .stat { flex: 1; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 12px 16px; }
  .stat-value { font-size: 22px; font-weight: 800; color: #1e3a8a; }
  .stat-label { font-size: 10px; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px; }
  .stat.pass .stat-value { color: #15803d; }
  .stat.fail .stat-value { color: #b91c1c; }
  .note { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; padding: 12px 16px; margin: 4px 0 20px; color: #1e3a8a; }
  .note strong { color: #1e3a8a; }
  .note.warn { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
  .note.warn strong { color: #9a3412; }
  h2.section-title { font-size: 15px; color: #1e3a8a; margin: 26px 0 4px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; page-break-after: avoid; }
  .section-lede { color: #64748b; margin: 0 0 12px; font-size: 11px; }
  table.sheet { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.sheet th { text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #475569; background: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 7px 8px; }
  table.sheet td { font-size: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding: 7px 8px; vertical-align: top; }
  table.sheet tr { page-break-inside: avoid; }
  table.sheet td.tcid { font-family: "SF Mono", Consolas, monospace; font-weight: 700; color: #1e3a8a; white-space: nowrap; }
  table.sheet td.num { text-align: right; color: #64748b; white-space: nowrap; }
  .steps { display: flex; flex-direction: column; gap: 14px; }
  .step-card { border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 10px; padding: 14px 16px; page-break-inside: avoid; background: #ffffff; }
  .step-card.fail { border-left-color: #dc2626; }
  .step-card header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .step-index { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #1e3a8a; color: white; font-size: 10px; font-weight: 700; }
  .step-card h3 { font-size: 13px; margin: 0; flex: 1; color: #0f172a; }
  .pill { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 999px; padding: 2px 8px; background: #e2e8f0; color: #475569; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.03em; border-radius: 999px; padding: 2px 10px; }
  .badge.pass { background: #dcfce7; color: #15803d; }
  .badge.fail { background: #fee2e2; color: #b91c1c; }
  .badge.skip { background: #fef3c7; color: #b45309; }
  .proves { color: #475569; margin: 0 0 8px; font-style: italic; }
  .proves strong { color: #334155; font-style: normal; }
  .step-card img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; }
  .step-card .error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px; white-space: pre-wrap; font-family: "SF Mono", Consolas, monospace; font-size: 10px; }
  .entry { page-break-inside: avoid; margin-bottom: 12px; }
  .entry h4 { font-size: 11px; margin: 0 0 6px; color: #334155; }
  .entry .error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px; white-space: pre-wrap; font-family: "SF Mono", Consolas, monospace; font-size: 10px; }
  .detail-list, .gap-list { margin: 0; padding-left: 18px; color: #475569; font-size: 11px; }
  .detail-list li, .gap-list li { margin-bottom: 4px; page-break-inside: avoid; }
  .detail-list code { font-family: "SF Mono", Consolas, monospace; color: #1e3a8a; font-weight: 700; }
  .missing { color: #94a3b8; font-style: italic; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; }
`;

export function buildProcessReportHtml(input: ProcessReportInput, resolveScreenshot: ScreenshotResolver): string {
  const {
    process: processName,
    index,
    total,
    steps,
    scenarios,
    platform,
    gaps,
    regressionRunId,
    journeyEvidenceMissing,
    regressionEvidenceMissing,
    generatedAt = new Date()
  } = input;

  const stepsPassed = steps.filter((item) => item.step.status === "passed").length;
  const scenariosPassed = scenarios.filter((row) => row.status === "passed").length;
  const failed =
    steps.filter((item) => item.step.status === "failed").length +
    scenarios.filter((row) => row.status === "failed").length;
  // Skips are documented, not failures, so they are excluded from the denominator rather than
  // dragging a healthy process below 100%.
  const rated = steps.length + scenarios.filter((row) => row.status !== "skipped").length;
  const passed = stepsPassed + scenariosPassed;
  const passRate = rated === 0 ? 0 : Math.round((passed / rated) * 100);
  const runIds = [...new Set(steps.map((item) => item.record.runId))];

  const cards = steps.length
    ? steps.map((item) => renderStepCard(item, resolveScreenshot)).join("\n")
    : `<p class="missing">No steps were recorded for this process — the journey that covers it likely did not run.</p>`;

  const warnings: string[] = [];
  if (journeyEvidenceMissing) {
    warnings.push(
      "No journey result file was produced for this run, so this report carries scenario evidence only. That usually means the stack failed to boot before the browser suite ran — check the uploaded Docker logs."
    );
  }
  if (regressionEvidenceMissing) {
    warnings.push(
      "No regression result file was found, so this report carries journey evidence only and its test case sheet is empty."
    );
  }

  const warningCallout = warnings.length
    ? `<div class="note warn"><strong>Incomplete evidence:</strong> ${warnings.map(escapeHtml).join(" ")}</div>`
    : "";

  const metaParts = [`Generated ${formatTimestamp(generatedAt.toISOString())}`];
  if (runIds.length) metaParts.push(`journey run${runIds.length > 1 ? "s" : ""} ${runIds.join(", ")}`);
  if (regressionRunId) metaParts.push(`scenario run ${regressionRunId}`);

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>${STYLES}</style></head>
<body>
  <header>
    <span class="eyebrow">TalentOS &middot; E2E Evidence &middot; Process ${index} of ${total}</span>
    <h1>${escapeHtml(processName)}</h1>
    <p class="description">${escapeHtml(PROCESS_DESCRIPTIONS[processName])}</p>
    <p class="meta">${escapeHtml(metaParts.join(" · "))}</p>
    <div class="stat-row">
      ${renderStat(String(scenarios.length), "SCENARIOS")}
      ${renderStat(String(steps.length), "STEPS")}
      ${renderStat(String(passed), "PASSED", "pass")}
      ${renderStat(String(failed), "FAILED", failed > 0 ? "fail" : "")}
      ${renderStat(`${passRate}%`, "PASS RATE", passRate === 100 ? "pass" : failed > 0 ? "fail" : "")}
    </div>
    ${warningCallout}
    <div class="note"><strong>Note:</strong> every screenshot below is captured live from the running local stack during this run — not a mockup or a stock screen. The test case sheet is the scenario suite's own result for this process, from the same run.</div>
  </header>

  <h2 class="section-title">Test Case Sheet</h2>
  <p class="section-lede">Scenario-level coverage for this process, from <code>scripts/regression/run.ts</code>. Failures are listed first.</p>
  ${renderSheet(scenarios, "No scenarios are scoped to this process in the run that produced this report.")}

  <h2 class="section-title">Platform Preconditions</h2>
  <p class="section-lede">${escapeHtml(PLATFORM_DESCRIPTION)}</p>
  ${renderSheet(platform, "No platform-scoped scenarios were recorded in this run.")}

  <h2 class="section-title">Journey Steps</h2>
  <p class="section-lede">Real browser sessions through the portals, one screenshot per step.</p>
  <section class="steps">${cards}</section>

  <h2 class="section-title">Failures &amp; Recorded Detail</h2>
  ${renderAppendix(steps, [...scenarios, ...platform])}

  <h2 class="section-title">Known Gaps &mdash; Not Covered</h2>
  <p class="section-lede">What this process's evidence does not prove.</p>
  ${renderGaps(gaps, [...scenarios, ...platform].filter((row) => row.status === "skipped"))}

  <footer>talentOS CI &middot; journeys:report:pdf &middot; ${escapeHtml(processName)}</footer>
</body>
</html>`;
}

function loadRecords(): JourneyRecord[] {
  if (!existsSync(RESULTS_DIR)) return [];
  const files = readdirSync(RESULTS_DIR).filter((name) => name.endsWith(".json") && name !== "playwright.json");
  const records: JourneyRecord[] = [];
  for (const file of files) {
    try {
      records.push(JSON.parse(readFileSync(join(RESULTS_DIR, file), "utf8")) as JourneyRecord);
    } catch (error) {
      process.stdout.write(`Could not parse ${file}, skipping it in the PDF reports: ${String(error)}\n`);
    }
  }
  return records;
}

/**
 * The newest regression payload, plus the file it came from so `main()` can copy it next to the
 * reports — that copy is what CI uploads, instead of the whole 80-file results directory.
 */
function loadRegression(): { payload: RegressionPayload | null; path: string | null } {
  const path = newestResultFile(REGRESSION_DIR);
  if (!path) return { payload: null, path: null };
  try {
    return { payload: JSON.parse(readFileSync(path, "utf8")) as RegressionPayload, path };
  } catch (error) {
    process.stdout.write(`Could not parse ${path}, rendering the reports without a test case sheet: ${String(error)}\n`);
    return { payload: null, path: null };
  }
}

function fileToDataUri(path: string): string | null {
  try {
    return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const records = loadRecords();
  const { payload, path: regressionPath } = loadRegression();
  const scenarioResults = payload?.results ?? [];

  if (records.length === 0 && scenarioResults.length === 0) {
    process.stdout.write(
      `No journey results under ${RESULTS_DIR} and no scenario results under ${REGRESSION_DIR} — nothing to report, skipping the per-process PDFs.\n`
    );
    return;
  }

  const resolveScreenshot: ScreenshotResolver = (journey, runId, filename) =>
    fileToDataUri(join(EVIDENCE_DIR, journey, runId, filename));

  const stepGroups = groupByProcess(flattenSteps(records));
  const scopeGroups = groupByScope(scenarioResults);
  const platform = scopeGroups.get(PLATFORM) ?? [];

  const inputs: ProcessReportInput[] = PROCESSES.map((processName, position) => ({
    process: processName,
    index: position + 1,
    total: PROCESSES.length,
    steps: stepGroups.get(processName) ?? [],
    scenarios: scopeGroups.get(processName) ?? [],
    platform,
    gaps: KNOWN_GAPS[processName],
    regressionRunId: payload?.runId ?? null,
    journeyEvidenceMissing: records.length === 0,
    regressionEvidenceMissing: scenarioResults.length === 0
  }));

  mkdirSync(REPORT_DIR, { recursive: true });

  // The scenario JSON this report was built from, parked next to the reports so the CI artifact can
  // carry exactly one regression result instead of globbing every run ever made.
  if (regressionPath) {
    try {
      copyFileSync(regressionPath, join(REPORT_DIR, "regression-run.json"));
    } catch (error) {
      process.stdout.write(`Could not copy ${regressionPath} next to the reports: ${String(error)}\n`);
    }
  }

  const outputPath = (position: number, processName: Process, extension: string) =>
    join(REPORT_DIR, `${String(position + 1).padStart(2, "0")}-${slugify(processName)}.${extension}`);

  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      for (const [position, input] of inputs.entries()) {
        const html = buildProcessReportHtml(input, resolveScreenshot);
        await page.setContent(html, { waitUntil: "load" });
        const path = outputPath(position, input.process, "pdf");
        await page.pdf({
          path,
          format: "A4",
          printBackground: true,
          margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" }
        });
        process.stdout.write(
          `Wrote ${path} (${input.steps.length} step${input.steps.length === 1 ? "" : "s"}, ${input.scenarios.length} scenario${input.scenarios.length === 1 ? "" : "s"})\n`
        );
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    // Falls back to raw HTML per process so the run still leaves human-readable artifacts behind
    // even if no browser is available to print them (e.g. Chromium wasn't installed).
    for (const [position, input] of inputs.entries()) {
      const html = buildProcessReportHtml(input, resolveScreenshot);
      writeFileSync(outputPath(position, input.process, "html"), html, "utf8");
    }
    process.stdout.write(`Could not render PDFs (${String(error)}); wrote HTML fallbacks to ${REPORT_DIR} instead.\n`);
  }
}

// Only when run as a CLI — a bare module-scope call would execute main() as a side effect of
// `npm test` importing buildProcessReportHtml.
//
// The `.catch` is not decoration: `main` is async, and before v0.20.13 it was called bare, so any
// rejection became an unhandled rejection and exited non-zero — a reporting script replacing a real
// test failure with a confusing one, which is exactly what the non-throwing contract forbids.
if (isCliEntrypoint(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stdout.write(`Could not write the per-process evidence reports: ${String(error)}\n`);
  });
}
