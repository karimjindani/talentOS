/**
 * Helpers shared by the CI reporting scripts (`v0.20.13`, D-112).
 *
 * `emit`, `escapePipes`, `seconds` and the CLI-invocation guard were copy-pasted across
 * `journey-report.ts`, `regression-summary.ts` and `journey-pdf-report.ts` — three copies of
 * `seconds` alone, with two different signatures. They live here now.
 *
 * Dependency-free apart from node built-ins, for the same reason as `evidence-taxonomy.ts`: the
 * scripts that import this run under `if: always()` and must never throw at import time.
 */
import { appendFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Appends to the GitHub step summary, falling back to stdout when it is unset (local runs) or
 * unwritable. Never throws — a reporting script must not replace a real test failure with a
 * confusing one.
 */
export function emit(markdown: string): void {
  // Trailing blank line, not just a newline: each call emits a whole Markdown block, and a heading
  // butted straight against the previous block's last line is a rendering coin toss.
  const block = `${markdown}\n\n`;
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) {
    process.stdout.write(block);
    return;
  }
  try {
    appendFileSync(target, block, "utf8");
  } catch (error) {
    process.stdout.write(`Could not write the step summary (${String(error)}); printing it instead:\n${markdown}\n`);
  }
}

/** Makes a value safe for a Markdown table cell: pipes escaped, newlines flattened. */
export function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** `1234` -> `"1.2s"`. Undefined renders as an em dash rather than `NaN`. */
export function seconds(ms: number | undefined): string {
  if (ms === undefined) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

/**
 * The newest `*.json` in a results directory, by mtime, or null when there is none.
 *
 * Lifted from `regression-summary.ts`. `.ops/regression-results/` accumulates one file per run —
 * 80+ locally — and only the run that just finished is the evidence for this report.
 */
export function newestResultFile(dir: string): string | null {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) return null;
  let newest: { path: string; mtimeMs: number } | null = null;
  for (const name of readdirSync(resolved)) {
    if (!name.endsWith(".json")) continue;
    const path = join(resolved, name);
    try {
      const { mtimeMs } = statSync(path);
      if (!newest || mtimeMs > newest.mtimeMs) newest = { path, mtimeMs };
    } catch {
      // A file that vanished between readdir and stat is not worth failing a report over.
    }
  }
  return newest?.path ?? null;
}

/**
 * True when `moduleUrl` is the file node was invoked with.
 *
 * Guards `main()` so it does not run as a side effect of `npm test` importing a renderer from the
 * same module.
 */
export function isCliEntrypoint(moduleUrl: string): boolean {
  const invokedPath = process.argv[1];
  if (!invokedPath) return false;
  try {
    return resolve(invokedPath) === resolve(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
