/**
 * Renders journey evidence into one PDF per named business process (v0.20.5) — not one combined
 * report. Every step from every journey JSON record (`applicant-arc`, `recruiter-access`) carries
 * a `process` tag (`tests/journeys/fixtures/types.ts`'s `PROCESSES`); this script groups steps by
 * that tag, in the shared canonical order, and renders one self-contained HTML document per group
 * (screenshots inlined as data URIs, no external requests), printed to PDF via Playwright's
 * already-installed Chromium (`page.pdf()`).
 *
 * `docs-only.spec.ts` does not use the `journey` fixture and writes no JSON here at all — it has
 * no "process", being a documentation screenshot sweep rather than a business process — so it
 * never appears in these reports. See docs/plans/v0.20.5_Full_Apprenticeship_Arc_And_Per_Process_Evidence_Reports.md.
 *
 * Same non-throwing contract as journey-report.ts / regression-summary.ts: this runs with
 * `if: always()`, including when the stack failed to boot and no evidence exists. The journey
 * step itself owns the pass/fail exit code; a crash here must not replace a real failure with a
 * confusing one.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
 * Mirrors `tests/journeys/fixtures/types.ts`'s `PROCESSES` exactly — this script runs outside
 * `tests/journeys/` against the JSON contract only (mirroring how `StepRecord`/`JourneyRecord`
 * above are already independent copies, not imports), so there is no compile-time link between
 * the two lists. Keep them in sync by hand.
 */
const PROCESSES = [
  "Applicant Signup & Approval",
  "Mission Acceptance & Journal",
  "Submission & Mission Acceptance",
  "Final Mission & Public Profile",
  "Recruiter Journey"
] as const;

type ProcessName = (typeof PROCESSES)[number];

const PROCESS_DESCRIPTIONS: Record<ProcessName, string> = {
  "Applicant Signup & Approval": "Keycloak signup, application submission, and org-admin acceptance.",
  "Mission Acceptance & Journal": "Accepting each weekly mission and writing the required engineering journal entries.",
  "Submission & Mission Acceptance": "Evidence submission and reviewer decisions for weeks 1-3, including the revision loop week 1 proves.",
  "Final Mission & Public Profile": "Accepting the 4th and final mission, consenting to publish, and confirming public visibility.",
  "Recruiter Journey": "The recruiter access-request lifecycle end to end, across both portals."
};

const RESULTS_DIR = resolve(process.argv[2] ?? join(".ops", "journey-results"));
const EVIDENCE_DIR = resolve(process.argv[3] ?? join(".ops", "journey-evidence"));
const REPORT_DIR = resolve(process.argv[4] ?? join(".ops", "journey-report"));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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
export function groupByProcess(flat: FlatStep[]): Map<ProcessName, FlatStep[]> {
  const groups = new Map<ProcessName, FlatStep[]>();
  for (const name of PROCESSES) groups.set(name, []);
  for (const item of flat) {
    const bucket = groups.get(item.step.process as ProcessName);
    if (bucket) bucket.push(item);
  }
  return groups;
}

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
  .proves { color: #475569; margin: 0 0 8px; font-style: italic; }
  .proves strong { color: #334155; font-style: normal; }
  .step-card img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; }
  .step-card .error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px; white-space: pre-wrap; font-family: "SF Mono", Consolas, monospace; font-size: 10px; }
  .missing { color: #94a3b8; font-style: italic; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; }
`;

export function buildProcessReportHtml(
  processName: ProcessName,
  processIndex: number,
  items: FlatStep[],
  resolveScreenshot: ScreenshotResolver,
  generatedAt = new Date()
): string {
  const passed = items.filter((item) => item.step.status === "passed").length;
  const failed = items.length - passed;
  const passRate = items.length === 0 ? 0 : Math.round((passed / items.length) * 100);
  const runIds = [...new Set(items.map((item) => item.record.runId))];

  const cards = items.length
    ? items.map((item) => renderStepCard(item, resolveScreenshot)).join("\n")
    : `<p class="missing">No steps were recorded for this process — the journey that covers it likely did not run.</p>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>${STYLES}</style></head>
<body>
  <header>
    <span class="eyebrow">TalentOS &middot; E2E Evidence &middot; Process ${processIndex} of ${PROCESSES.length}</span>
    <h1>${escapeHtml(processName)}</h1>
    <p class="description">${escapeHtml(PROCESS_DESCRIPTIONS[processName])}</p>
    <p class="meta">Generated ${escapeHtml(formatTimestamp(generatedAt.toISOString()))}${
      runIds.length ? ` &middot; run${runIds.length > 1 ? "s" : ""} ${runIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}` : ""
    }</p>
    <div class="stat-row">
      ${renderStat(String(items.length), "STEPS")}
      ${renderStat(String(passed), "PASSED", "pass")}
      ${renderStat(String(failed), "FAILED", failed > 0 ? "fail" : "")}
      ${renderStat(`${passRate}%`, "PASS RATE", passRate === 100 ? "pass" : failed > 0 ? "fail" : "")}
    </div>
    <div class="note"><strong>Note:</strong> every screenshot below is captured live from the running local stack during this run — not a mockup or a stock screen.</div>
  </header>
  <section class="steps">${cards}</section>
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

function fileToDataUri(path: string): string | null {
  try {
    return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const records = loadRecords();
  if (records.length === 0) {
    process.stdout.write(`No journey result files found under ${RESULTS_DIR} — skipping the per-process PDF reports.\n`);
    return;
  }

  const resolveScreenshot: ScreenshotResolver = (journey, runId, filename) =>
    fileToDataUri(join(EVIDENCE_DIR, journey, runId, filename));

  const groups = groupByProcess(flattenSteps(records));

  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      mkdirSync(REPORT_DIR, { recursive: true });
      for (const [processIndex, processName] of PROCESSES.entries()) {
        const items = groups.get(processName) ?? [];
        const html = buildProcessReportHtml(processName, processIndex + 1, items, resolveScreenshot);
        await page.setContent(html, { waitUntil: "load" });
        const path = join(REPORT_DIR, `${String(processIndex + 1).padStart(2, "0")}-${slugify(processName)}.pdf`);
        await page.pdf({ path, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
        process.stdout.write(`Wrote ${path} (${items.length} step${items.length === 1 ? "" : "s"})\n`);
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    // Falls back to raw HTML per process so the run still leaves human-readable artifacts behind
    // even if no browser is available to print them (e.g. Chromium wasn't installed).
    mkdirSync(REPORT_DIR, { recursive: true });
    for (const [processIndex, processName] of PROCESSES.entries()) {
      const items = groups.get(processName) ?? [];
      const html = buildProcessReportHtml(processName, processIndex + 1, items, resolveScreenshot);
      const fallback = join(REPORT_DIR, `${String(processIndex + 1).padStart(2, "0")}-${slugify(processName)}.html`);
      writeFileSync(fallback, html, "utf8");
    }
    process.stdout.write(`Could not render PDFs (${String(error)}); wrote HTML fallbacks to ${REPORT_DIR} instead.\n`);
  }
}

// Only when run as a CLI — see journey-report.ts for why this guard exists (a bare module-scope
// call would execute main() as a side effect of `npm test` importing buildProcessReportHtml).
const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
