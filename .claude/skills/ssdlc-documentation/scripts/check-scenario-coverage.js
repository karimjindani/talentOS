#!/usr/bin/env node
/*
 * Checks that every scenario in a docs/plans/*.md plan's "Test Scenarios" section has a matching
 * row in the corresponding docs/testing/*_Test_Results.md "Scenario Results" table.
 *
 * This is docs/testing/TEMPLATE.md's own rule made mechanical: "If any plan scenario is missing
 * from this table, the test-results doc is incomplete." Historically this repo has expressed
 * scenarios two ways, both handled here:
 *   - heading form:  "### Scenario S1: <title>"           (e.g. v0.19.5)
 *   - bullet form:   "- **Scenario**: <title>"             (e.g. v0.19.0, v0.19.2)
 *
 * Usage:
 *   node check-scenario-coverage.js v0.19.5
 *   node check-scenario-coverage.js docs/plans/v0.19.5_Foo.md docs/testing/v0.19.5_Foo_Test_Results.md
 *
 * Exit code 0 if every plan scenario has a matching test-results row, 1 otherwise (or on error).
 */
const fs = require('fs');
const path = require('path');

function findRepoRoot() {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'docs', 'sdlc.md'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not locate repo root (no docs/sdlc.md in any parent directory)');
    }
    dir = parent;
  }
  return dir;
}

function resolveFilesByVersion(root, version) {
  const plansDir = path.join(root, 'docs', 'plans');
  const testingDir = path.join(root, 'docs', 'testing');
  const planFile = fs
    .readdirSync(plansDir)
    .find((f) => f.startsWith(`${version}_`) && f.endsWith('.md') && f !== 'TEMPLATE.md');
  const testFile = fs.readdirSync(testingDir).find((f) => f.startsWith(`${version}_`) && f.endsWith('_Test_Results.md'));
  if (!planFile) throw new Error(`No plan file found in docs/plans/ starting with "${version}_"`);
  if (!testFile) throw new Error(`No test-results file found in docs/testing/ starting with "${version}_"`);
  return [path.join(plansDir, planFile), path.join(testingDir, testFile)];
}

// Returns the body text of a "## <headingText>" section, up to (not including) the next "## " heading.
function extractSection(text, headingText) {
  const startRe = new RegExp(`^##\\s*${headingText}\\s*$`, 'm');
  const startMatch = startRe.exec(text);
  if (!startMatch) return null;
  const rest = text.slice(startMatch.index + startMatch[0].length);
  const nextHeadingMatch = /^##\s/m.exec(rest);
  return nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;
}

function extractPlanScenarios(planText) {
  const section = extractSection(planText, 'Test Scenarios');
  if (section === null) return null;

  const scenarios = [];
  const seen = new Set();

  const headingRe = /^#{2,4}\s*Scenario\s+([A-Za-z0-9]+)\s*:\s*(.+?)\s*$/gm;
  let m;
  while ((m = headingRe.exec(section))) {
    const key = `id:${m[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scenarios.push({ id: m[1], title: m[2], display: `${m[1]}: ${m[2]}` });
  }

  const bulletRe = /^-\s*\*\*Scenario\*\*:\s*(.+?)\s*$/gm;
  while ((m = bulletRe.exec(section))) {
    const title = m[1];
    const key = `title:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scenarios.push({ id: null, title, display: title });
  }

  return scenarios;
}

function extractResultRows(testText) {
  const section = extractSection(testText, 'Scenario Results');
  if (section === null) return null;

  const rows = [];
  let dataRowIndex = 0;
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|');
    const firstCell = cells[1] ? cells[1].trim() : '';
    if (!firstCell) continue;
    if (/^-{2,}$/.test(firstCell)) continue; // separator row, e.g. "| --- | --- |"
    dataRowIndex++;
    if (dataRowIndex === 1) continue; // header row, e.g. "| Scenario | Automation | Result |"
    rows.push(firstCell);
  }
  return rows;
}

function normalize(s) {
  // Strip trailing sentence punctuation too: plan bullets are sometimes written as full
  // sentences ("...the dashboard.") while table cells drop the period, and vice versa.
  return s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?:;]+$/, '');
}

function scenarioMatchesRow(scenario, normalizedRow) {
  if (scenario.id && normalizedRow.startsWith(`${normalize(scenario.id)}:`)) return true;
  return normalizedRow.includes(normalize(scenario.title));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node check-scenario-coverage.js <vX.Y.Z> | <plan.md> <test-results.md>');
    process.exit(2);
  }

  const root = findRepoRoot();
  const [planPath, testPath] = args.length === 1 ? resolveFilesByVersion(root, args[0]) : args;

  const planText = fs.readFileSync(planPath, 'utf8');
  const testText = fs.readFileSync(testPath, 'utf8');

  console.log(`Plan:         ${planPath}`);
  console.log(`Test results: ${testPath}\n`);

  const scenarios = extractPlanScenarios(planText);
  if (scenarios === null) {
    console.log('No "## Test Scenarios" section found in the plan.');
    process.exit(1);
  }
  if (scenarios.length === 0) {
    console.log('"## Test Scenarios" section is present but empty — the plan template requires this');
    console.log('section to list at least the primary happy path, an authorization/role-denial case,');
    console.log('a tenant-isolation case (if applicable), and a negative/edge case.');
    process.exit(1);
  }

  const rows = extractResultRows(testText);
  if (rows === null) {
    console.log('No "## Scenario Results" section found in the test-results doc.');
    process.exit(1);
  }

  const normRows = rows.map(normalize);
  let missing = 0;
  console.log('Plan scenario coverage:');
  for (const sc of scenarios) {
    const found = normRows.some((r) => scenarioMatchesRow(sc, r));
    console.log(`  [${found ? 'OK' : 'MISSING'}] ${sc.display}`);
    if (!found) missing++;
  }

  const unmatchedRows = rows.filter((r) => !scenarios.some((sc) => scenarioMatchesRow(sc, normalize(r))));
  if (unmatchedRows.length > 0) {
    console.log('\nTest-results rows with no matching plan scenario (check for drift/renames):');
    for (const r of unmatchedRows) console.log(`  - ${r}`);
  }

  console.log(`\n${scenarios.length - missing}/${scenarios.length} plan scenarios have a matching test-results row.`);
  if (missing > 0) {
    console.log(`\n${missing} scenario(s) missing a test-results row. Per docs/sdlc.md, either add a`);
    console.log('row (Passed/Failed/Skipped with evidence) or confirm it is recorded as a Known Gap');
    console.log('in docs/Regression_Scenarios.md — a plan scenario absent from both is a silent gap.');
    process.exit(1);
  }
  console.log('\nAll plan scenarios accounted for.');
}

try {
  main();
} catch (err) {
  console.error('check-scenario-coverage.js failed:', err.message);
  process.exit(1);
}
