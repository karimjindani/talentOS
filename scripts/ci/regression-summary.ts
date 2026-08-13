/**
 * Renders the newest regression run into a GitHub Actions step summary.
 *
 * `scripts/regression/run.ts` already writes a machine-readable result file per run; this turns the
 * latest one into Markdown on `$GITHUB_STEP_SUMMARY` so the outcome is readable on the run page
 * without downloading the artifact. The repository is public, so that page is the shared evidence
 * surface for a change.
 *
 * Deliberately dependency-free and non-throwing: it runs with `if: always()`, including when the
 * stack failed to boot and no result file exists. A crash here would replace the real failure with a
 * confusing one, so every problem is reported as summary text and the process still exits 0. The
 * regression step itself owns the pass/fail exit code.
 *
 * Usage:
 *   npx tsx scripts/ci/regression-summary.ts [resultsDir]
 *   GITHUB_STEP_SUMMARY=/tmp/summary.md npx tsx scripts/ci/regression-summary.ts   # local check
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

type ScenarioResult = {
  area: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs?: number;
  detail?: string;
  error?: string;
};

type RegressionPayload = {
  runId?: string;
  summary?: { area?: string; total?: number; passed?: number; failed?: number; skipped?: number; durationMs?: number };
  results?: ScenarioResult[];
};

const RESULTS_DIR = resolve(process.argv[2] ?? join(".ops", "regression-results"));

function emit(markdown: string): void {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) {
    process.stdout.write(`${markdown}\n`);
    return;
  }
  try {
    appendFileSync(target, `${markdown}\n`, "utf8");
  } catch (error) {
    // Never let summary writing fail the job.
    process.stdout.write(`Could not write step summary: ${String(error)}\n${markdown}\n`);
  }
}

/** Newest result file by modification time, or null when none exists. */
function newestResultFile(): string | null {
  if (!existsSync(RESULTS_DIR)) return null;
  const files = readdirSync(RESULTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(RESULTS_DIR, name));
  if (files.length === 0) return null;
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const ICON: Record<ScenarioResult["status"], string> = {
  passed: "✅",
  failed: "❌",
  skipped: "⏭️"
};

/** Failures first: the reason someone opens this page is to find what broke. */
const ORDER: Record<ScenarioResult["status"], number> = { failed: 0, skipped: 1, passed: 2 };

function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function seconds(ms: number | undefined): string {
  return typeof ms === "number" ? `${(ms / 1000).toFixed(1)}s` : "—";
}

function main(): void {
  const file = newestResultFile();
  if (!file) {
    emit(
      "## E2E scenario evidence\n\n" +
        "⚠️ **No regression result file was produced.**\n\n" +
        `Nothing matched \`${RESULTS_DIR}/*.json\`, which usually means the stack failed to boot ` +
        "before the suite ran. Check the bootstrap step's log and the uploaded Docker logs."
    );
    return;
  }

  let payload: RegressionPayload;
  try {
    payload = JSON.parse(readFileSync(file, "utf8")) as RegressionPayload;
  } catch (error) {
    emit(`## E2E scenario evidence\n\n⚠️ Could not parse \`${file}\`: ${String(error)}`);
    return;
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
      lines.push(`**${escapePipes(f.name)}** _(${f.area})_`, "", "```", (f.error ?? "no error text").trim(), "```", "");
    }
  }

  lines.push("### All scenarios", "", "| | Area | Scenario | Time |", "| --- | --- | --- | --- |");
  for (const r of [...results].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.area.localeCompare(b.area))) {
    lines.push(`| ${ICON[r.status]} | ${r.area} | ${escapePipes(r.name)} | ${seconds(r.durationMs)} |`);
  }

  const skips = results.filter((r) => r.status === "skipped");
  if (skips.length > 0) {
    lines.push("", "### Skipped", "");
    for (const r of skips) lines.push(`- **${escapePipes(r.name)}** _(${r.area})_ — ${escapePipes(r.error ?? "no reason given")}`);
  }

  lines.push(
    "",
    "---",
    "",
    "Full results JSON and the captured portal screenshots are attached to this run as the " +
      "**e2e-evidence** artifact."
  );

  emit(lines.join("\n"));
}

main();
