/**
 * Renders journey evidence into a GitHub step summary and a per-journey Markdown document.
 *
 * Same contract as scripts/ci/regression-summary.ts: dependency-free and non-throwing. It runs with
 * `if: always()`, including when the stack failed to boot and no evidence exists — a crash here
 * would replace the real failure with a confusing one. The journey step itself owns the pass/fail
 * exit code; this script only reports.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

function emit(markdown: string): void {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) {
    process.stdout.write(`${markdown}\n`);
    return;
  }
  try {
    appendFileSync(target, `${markdown}\n`, "utf8");
  } catch (error) {
    process.stdout.write(`Could not write step summary: ${String(error)}\n${markdown}\n`);
  }
}

/** Table cells must survive a claim containing a pipe or a newline. */
function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

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
      lines.push(
        `**${step.index}. ${escapePipes(step.name)}**`,
        "",
        "```",
        (step.error ?? "no error text").trim(),
        "```",
        ""
      );
    }
  }

  return lines.join("\n");
}

function main(): void {
  if (!existsSync(RESULTS_DIR)) {
    emit(
      "## Journey evidence\n\n⚠️ **No journey results were produced.**\n\n" +
        `Nothing matched \`${RESULTS_DIR}/*.json\`, which usually means the stack failed to boot ` +
        "before the journeys ran. Check the bootstrap step's log and the uploaded Docker logs."
    );
    return;
  }

  // playwright.json is the reporter's own output, not a JourneyRecord.
  const files = readdirSync(RESULTS_DIR).filter((name) => name.endsWith(".json") && name !== "playwright.json");
  if (files.length === 0) {
    emit("## Journey evidence\n\n⚠️ No journey result files found.");
    return;
  }

  for (const file of files) {
    let record: JourneyRecord;
    try {
      record = JSON.parse(readFileSync(join(RESULTS_DIR, file), "utf8")) as JourneyRecord;
    } catch (error) {
      emit(`## Journey evidence\n\n⚠️ Could not parse \`${file}\`: ${String(error)}`);
      continue;
    }

    const markdown = renderJourneyMarkdown(record);
    emit(markdown);

    try {
      // Matches the fixture's layout: .ops/journey-evidence/<journey>/<runId>/, so evidence.md sits
      // beside the screenshots it references and a CI retry cannot overwrite the first attempt.
      const dir = join(EVIDENCE_DIR, record.journey, record.runId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "evidence.md"), `${markdown}\n`, "utf8");
    } catch (error) {
      process.stdout.write(`Could not write evidence document: ${String(error)}\n`);
    }
  }
}

// Only when run as a CLI. Without this guard, importing `renderJourneyMarkdown` from the unit test
// would execute main() as a side effect — scanning .ops and writing files during `npm test`.
const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
