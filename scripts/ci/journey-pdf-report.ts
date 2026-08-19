/**
 * Renders every journey's evidence — the step table plus its screenshots — into one PDF report
 * and uploads alongside the raw JSON/PNGs as a CI artifact.
 *
 * Unlike apps/applicant/lib/candidate-report.ts (a hand-rolled, dependency-free PDF writer
 * because it runs inside a live Next.js API route with no browser available), this script runs
 * as a CI step where Playwright's Chromium is already installed for the journeys themselves —
 * so it renders one self-contained HTML document (screenshots inlined as data URIs, no external
 * requests) and prints it to PDF with `page.pdf()`, which handles image layout, pagination and
 * table formatting for free.
 *
 * Same non-throwing contract as journey-report.ts / regression-summary.ts: this runs with
 * `if: always()`, including when the stack failed to boot and no evidence exists. The journey
 * step itself owns the pass/fail exit code; a crash here must not replace a real failure with a
 * confusing one.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type StepRecord = {
  index: number;
  name: string;
  actor: string;
  proves: string;
  status: "passed" | "failed";
  durationMs: number;
  screenshot: string | null;
  error?: string;
};

type JourneyRecord = {
  journey: string;
  runId: string;
  startedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  steps: StepRecord[];
};

const RESULTS_DIR = resolve(process.argv[2] ?? join(".ops", "journey-results"));
const EVIDENCE_DIR = resolve(process.argv[3] ?? join(".ops", "journey-evidence"));
const REPORT_DIR = resolve(process.argv[4] ?? join(".ops", "journey-report"));
const REPORT_PATH = join(REPORT_DIR, "talentos-e2e-evidence-report.pdf");

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

/** Resolves a step's screenshot to an embeddable data URI, or null when there is none to embed. */
export type ScreenshotResolver = (journey: string, runId: string, filename: string) => string | null;

function renderSummaryCard(value: string, label: string, tone: "" | "pass" | "fail" = ""): string {
  return `<div class="stat ${tone}"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

function renderStepRow(step: StepRecord): string {
  const resultClass = step.status === "passed" ? "pass" : "fail";
  const resultLabel = step.status === "passed" ? `Passed · ${seconds(step.durationMs)}` : "Failed";
  return `<tr>
    <td>${step.index}</td>
    <td>${escapeHtml(step.actor)}</td>
    <td>${escapeHtml(step.name)}</td>
    <td>${escapeHtml(step.proves)}</td>
    <td class="${resultClass}">${escapeHtml(resultLabel)}</td>
  </tr>`;
}

function renderStepEvidence(step: StepRecord, screenshotDataUri: string | null): string {
  if (step.status === "failed") {
    return `<div class="step-evidence fail">
      <h3>${step.index}. ${escapeHtml(step.name)}</h3>
      <pre class="error">${escapeHtml(step.error ?? "no error text")}</pre>
    </div>`;
  }
  if (!screenshotDataUri) {
    return `<div class="step-evidence">
      <h3>${step.index}. ${escapeHtml(step.name)}</h3>
      <p class="missing">No screenshot was captured for this step.</p>
    </div>`;
  }
  return `<div class="step-evidence">
    <h3>${step.index}. ${escapeHtml(step.name)}</h3>
    <img src="${screenshotDataUri}" alt="${escapeHtml(step.name)}" />
  </div>`;
}

function renderJourneySection(record: JourneyRecord, resolveScreenshot: ScreenshotResolver, first: boolean): string {
  const passed = record.steps.filter((step) => step.status === "passed").length;
  const badgeClass = record.status === "passed" ? "pass" : "fail";
  const badgeLabel = record.status === "passed" ? "PASSED" : "FAILED";

  const rows = record.steps.map(renderStepRow).join("\n");
  const evidence = record.steps
    .map((step) => renderStepEvidence(step, step.screenshot ? resolveScreenshot(record.journey, record.runId, step.screenshot) : null))
    .join("\n");

  return `<section class="journey" ${first ? "" : 'style="page-break-before: always;"'}>
    <h2>Journey: ${escapeHtml(record.journey)} <span class="badge ${badgeClass}">${badgeLabel}</span></h2>
    <p class="meta">Run <code>${escapeHtml(record.runId)}</code> · started ${escapeHtml(formatTimestamp(record.startedAt))} · ${escapeHtml(
      seconds(record.durationMs)
    )} · ${passed}/${record.steps.length} steps passed</p>
    <table>
      <thead><tr><th>#</th><th>Actor</th><th>Step</th><th>Proves</th><th>Result</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="missing">This journey recorded no steps.</td></tr>`}</tbody>
    </table>
    <h3 class="evidence-heading">Evidence</h3>
    ${evidence || `<p class="missing">No step evidence was captured.</p>`}
  </section>`;
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px 40px; font-size: 12px; }
  h1 { font-size: 24px; margin: 4px 0; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  h3 { font-size: 12px; margin: 12px 0 6px; color: #334155; }
  .eyebrow { color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; }
  .meta { color: #64748b; margin: 0 0 12px; }
  .stat-row { display: flex; gap: 12px; margin: 16px 0 24px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; min-width: 90px; }
  .stat-value { font-size: 20px; font-weight: 700; }
  .stat-label { font-size: 10px; color: #64748b; letter-spacing: 0.04em; }
  .stat.pass .stat-value { color: #16a34a; }
  .stat.fail .stat-value { color: #dc2626; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; border-radius: 999px; padding: 2px 10px; vertical-align: middle; }
  .badge.pass { background: #dcfce7; color: #15803d; }
  .badge.fail { background: #fee2e2; color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; font-size: 11px; }
  th { background: #f8fafc; font-size: 10px; letter-spacing: 0.03em; color: #475569; }
  td.pass { color: #15803d; }
  td.fail { color: #b91c1c; font-weight: 600; }
  .evidence-heading { border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .step-evidence { page-break-inside: avoid; margin-bottom: 14px; }
  .step-evidence img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; }
  .step-evidence.fail .error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 6px; padding: 8px; white-space: pre-wrap; font-family: "SF Mono", Consolas, monospace; font-size: 10px; }
  .missing { color: #94a3b8; font-style: italic; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; }
`;

export function buildJourneyReportHtml(records: JourneyRecord[], resolveScreenshot: ScreenshotResolver, generatedAt = new Date()): string {
  const totalSteps = records.reduce((sum, record) => sum + record.steps.length, 0);
  const passedSteps = records.reduce((sum, record) => sum + record.steps.filter((step) => step.status === "passed").length, 0);
  const failedSteps = totalSteps - passedSteps;
  const passRate = totalSteps === 0 ? 0 : Math.round((passedSteps / totalSteps) * 100);

  const sections = records.length
    ? records.map((record, index) => renderJourneySection(record, resolveScreenshot, index === 0)).join("\n")
    : `<section class="journey"><p class="missing">No journey results were found — the stack likely failed to boot before the journeys ran.</p></section>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>${STYLES}</style></head>
<body>
  <header>
    <div class="eyebrow">TALENTOS · E2E EVIDENCE</div>
    <h1>Journey Evidence Report</h1>
    <p class="meta">Generated ${escapeHtml(formatTimestamp(generatedAt.toISOString()))} · ${records.length} journey(s)</p>
    <div class="stat-row">
      ${renderSummaryCard(String(totalSteps), "STEPS")}
      ${renderSummaryCard(String(passedSteps), "PASSED", "pass")}
      ${renderSummaryCard(String(failedSteps), "FAILED", failedSteps > 0 ? "fail" : "")}
      ${renderSummaryCard(`${passRate}%`, "PASS RATE", passRate === 100 ? "pass" : failedSteps > 0 ? "fail" : "")}
    </div>
  </header>
  ${sections}
  <footer>talentOS CI · journeys:report:pdf</footer>
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
      process.stdout.write(`Could not parse ${file}, skipping it in the PDF report: ${String(error)}\n`);
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
    process.stdout.write(`No journey result files found under ${RESULTS_DIR} — skipping the PDF report.\n`);
    return;
  }

  const resolveScreenshot: ScreenshotResolver = (journey, runId, filename) =>
    fileToDataUri(join(EVIDENCE_DIR, journey, runId, filename));

  const html = buildJourneyReportHtml(records, resolveScreenshot);

  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      mkdirSync(REPORT_DIR, { recursive: true });
      await page.pdf({ path: REPORT_PATH, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    } finally {
      await browser.close();
    }
    process.stdout.write(`Wrote journey PDF report to ${REPORT_PATH}\n`);
  } catch (error) {
    // Falls back to the raw HTML so the run still leaves a human-readable artifact behind even if
    // no browser is available to print it (e.g. Chromium wasn't installed in this environment).
    mkdirSync(REPORT_DIR, { recursive: true });
    const fallback = join(REPORT_DIR, "talentos-e2e-evidence-report.html");
    writeFileSync(fallback, html, "utf8");
    process.stdout.write(`Could not render the PDF report (${String(error)}); wrote the HTML fallback to ${fallback} instead.\n`);
  }
}

// Only when run as a CLI — see journey-report.ts for why this guard exists (a bare module-scope
// call would execute main() as a side effect of `npm test` importing buildJourneyReportHtml).
const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
