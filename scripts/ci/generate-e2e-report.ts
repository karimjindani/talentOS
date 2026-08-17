#!/usr/bin/env tsx
/**
 * Generate a complete HTML and PDF E2E evidence report from the newest regression
 * result JSON, per-scenario evidence files, HTTP evidence, screenshots, and
 * screenshot mapping. Implements all 8 evidence requirements.
 *
 * Usage:
 *   npx tsx scripts/ci/generate-e2e-report.ts [resultsDir] [screenshotsDir] [outDir] [--pii=mask|remove|none]
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

// ── Types ──────────────────────────────────────────────────────────────────────
type ScenarioResult = { area: string; name: string; status: string; durationMs?: number; detail?: string; error?: string };
type RegressionPayload = {
  runId?: string;
  summary?: { area?: string; total?: number; passed?: number; failed?: number; skipped?: number; durationMs?: number };
  results?: ScenarioResult[];
};

type HttpEntry = {
  timestamp: string;
  scenario?: string | null;
  request?: { method?: string; url?: string; headers?: Record<string, string>; body?: string | null };
  response?: { status?: number | null; statusText?: string | null; headers?: Record<string, string>; bodySize?: number | null; body?: string | null; error?: string | null };
  durationMs?: number;
};

type ScenarioEvidence = {
  id: string;
  area: string;
  name: string;
  expected: string | null;
  actual: string | null;
  result: string;
  durationMs?: number;
  sourceFile?: string;
};

type ScreenshotMap = {
  runId?: string;
  mapped?: Record<string, Array<{ step: number; file: string; caption: string }>>;
  journeys?: Array<{ name: string; description: string; steps: Array<{ step: number; file: string; caption: string; tcId?: string }> }>;
  unmapped?: Array<{ file: string; note: string }>;
  generatedAt?: string;
};

// ── CLI args ───────────────────────────────────────────────────────────────────
const resultsDir = resolve(process.argv[2] ?? '.ops/regression-results');
const screenshotsDir = resolve(process.argv[3] ?? 'docs/user-guides/screenshots');
const outDir = resolve(process.argv[4] ?? 'docs/reports');
const piiArg = (process.argv.find((a) => a.startsWith('--pii=')) || '--pii=mask').split('=')[1] as 'mask' | 'remove' | 'none';
const MAX_BODY_DISPLAY = 5000;

// ── Utilities ──────────────────────────────────────────────────────────────────
function newestResultFile(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f));
  if (files.length === 0) return null;
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function maskSensitive(value: string): string {
  if (!value || piiArg === 'none') return value;
  if (piiArg === 'remove') return '[REMOVED]';
  let v = value;
  // ── Redact entire cookie / set-cookie header values in JSON string format ──
  // Handles values with escaped quotes (Keycloak cookies like KEYCLOAK_IDENTITY="...")
  // Strategy: match from "cookie"/"set-cookie" key to the closing quote that ends the JSON string value.
  // Since JSON.stringify may produce values with escaped \", we match up to the next line boundary.
  v = v.replace(/("(?:cookie|set-cookie)"\s*:\s*")[^"]*(?:\\"[^"]*)*"/gi, '$1[REDACTED]"');
  // Fallback: if the above didn't fully redact (escaped quotes broke the match), redact any
  // remaining set-cookie value content that contains Keycloak/auth cookie identifiers
  v = v.replace(/("set-cookie"\s*:\s*"\[REDACTED\]")([^\n"]+)/gi, '$1"');
  v = v.replace(/talentos\/[a-z0-9.]+\/[a-z0-9.*]+/gi, '[REDACTED]');
  // ── Redact authorization header values in JSON string format ──
  v = v.replace(/("authorization"\s*:\s*")[^"]*"/gi, '$1[REDACTED]"');
  // ── Redact authjs.* cookie token values (any format, including URL-encoded) ──
  v = v.replace(/(authjs\.[a-zA-Z0-9_.-]+)=[^;\s"\]]+/g, '$1=[REDACTED]');
  // ── Redact any remaining cookie key=value pairs containing csrf/session/nonce ──
  v = v.replace(/((?:csrf|session|nonce|__Secure|__Host)[a-zA-Z0-9_.-]*)=[^;\s"\]]+/gi, '$1=[REDACTED]');
  // ── Sensitive query parameters in URLs ──
  v = v.replace(/([?&](?:code|session_state|state|code_verifier|code_challenge|token|access_token|id_token|refresh_token|client_secret|password|credentialId)=)[^&\s"\]]+/g, '$1[REDACTED]');
  // ── Password / secret fields in JSON bodies ──
  v = v.replace(/("(?:password|passwd|secret|client_secret|api_key|access_token|refresh_token|id_token|token|credentialId|code_verifier|private_key)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"');
  v = v.replace(/("(?:password|passwd|secret|client_secret|api_key|access_token|refresh_token|id_token|token|credentialId|code_verifier|private_key)"\s*:\s*)([^,}\s"]+)/gi, '$1[REDACTED]');
  // ── Bearer tokens ──
  v = v.replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1[REDACTED]');
  // ── JWT tokens ──
  v = v.replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[REDACTED-JWT]');
  // ── Emails ──
  v = v.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => m.replace(/(.{2}).+(@.+)/, '$1****$2'));
  // ── Long digit sequences (CNIC/account/ID) ──
  v = v.replace(/(\d{2})(\d{4,})(\d{2})/g, (_m, a, b, c) => `${a}${'*'.repeat(Math.min(6, b.length))}${c}`);
  // ── UUIDs ──
  v = v.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) => m.slice(0, 6) + '...');
  return v;
}

function truncateBody(body: string | null | undefined): string {
  if (!body) return '';
  const masked = maskSensitive(body);
  return masked.length > MAX_BODY_DISPLAY ? masked.slice(0, MAX_BODY_DISPLAY) + '\n[TRUNCATED]' : masked;
}

function embedImageAsDataUri(path: string): string {
  try {
    const data = readFileSync(path);
    const ext = path.split('.').pop() ?? 'png';
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return '';
  }
}

function sha256(filePath: string): string {
  try {
    const data = readFileSync(filePath);
    return createHash('sha256').update(data).digest('hex');
  } catch {
    return '[error computing checksum]';
  }
}

function tcId(area: string, name: string): string {
  return `TC-${area.toUpperCase()}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function scenarioSlug(area: string, name: string): string {
  return `${area}--${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function seconds(ms: number | undefined): string {
  return typeof ms === 'number' ? `${(ms / 1000).toFixed(1)}s` : '—';
}

function deriveExpected(r: ScenarioResult): string {
  return r.name;
}

function deriveActual(r: ScenarioResult): string {
  if (r.error) return `Error: ${r.error}`;
  if (r.detail) return r.detail;
  if (r.status === 'passed') return 'Scenario completed successfully.';
  if (r.status === 'skipped') return 'Scenario was skipped.';
  return `Status: ${r.status}`;
}

// ── Main render ────────────────────────────────────────────────────────────────
async function render() {
  const file = newestResultFile(resultsDir);
  let payload: RegressionPayload = {};
  try {
    if (file) payload = JSON.parse(readFileSync(file, 'utf8')) as RegressionPayload;
  } catch (err) {
    console.warn('Failed to parse regression result JSON:', err);
  }

  const results = payload.results ?? [];
  const s = payload.summary ?? {};
  const total = s.total ?? results.length;
  const passed = s.passed ?? results.filter((r) => r.status === 'passed').length;
  const failed = s.failed ?? results.filter((r) => r.status === 'failed').length;
  const skipped = s.skipped ?? results.filter((r) => r.status === 'skipped').length;

  mkdirSync(outDir, { recursive: true });
  const runId = payload.runId ?? `run-${Date.now()}`;
  const evidenceDir = resolve('.ops', 'evidence', runId);

  // ── Load evidence files ─────────────────────────────────────────────────────
  let runInfo: any = null;
  try {
    const riPath = join(evidenceDir, 'run-info.json');
    if (existsSync(riPath)) runInfo = JSON.parse(readFileSync(riPath, 'utf8'));
  } catch {}

  let gaps: any[] = [];
  try {
    const gapsPath = join(evidenceDir, 'gaps.json');
    if (existsSync(gapsPath)) gaps = (JSON.parse(readFileSync(gapsPath, 'utf8')).gaps) ?? [];
  } catch {}

  const scenarioEvidence: Record<string, ScenarioEvidence> = {};
  try {
    const scenFiles = readdirSync(evidenceDir).filter((f) => f.startsWith('scenario-') && f.endsWith('.json'));
    for (const sf of scenFiles) {
      const obj = JSON.parse(readFileSync(join(evidenceDir, sf), 'utf8')) as ScenarioEvidence;
      scenarioEvidence[obj.id] = obj;
    }
  } catch {}

  const httpEvidence: Record<string, HttpEntry[]> = {};
  try {
    const httpFiles = readdirSync(evidenceDir).filter((f) => f.startsWith('http-evidence-') && f.endsWith('.json') && !f.includes('ui'));
    for (const hf of httpFiles) {
      const obj = JSON.parse(readFileSync(join(evidenceDir, hf), 'utf8'));
      const scenarioKey = obj.scenario ?? basename(hf, '.json');
      httpEvidence[scenarioKey] = obj.entries ?? [];
    }
  } catch {}

  let screenshotMap: ScreenshotMap = {};
  try {
    const smPath = join(evidenceDir, 'screenshots-map.json');
    if (existsSync(smPath)) screenshotMap = JSON.parse(readFileSync(smPath, 'utf8'));
  } catch {}

  // ── CSS ─────────────────────────────────────────────────────────────────────
  const css = `
    <style>
      body { font-family: Inter, system-ui, Arial, sans-serif; padding: 24px; color: #222; background: #fff; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      h2 { font-size: 20px; margin-top: 32px; border-bottom: 2px solid #e0e0e0; padding-bottom: 4px; }
      h3 { font-size: 16px; margin-top: 20px; }
      h4 { font-size: 14px; margin-top: 12px; color: #555; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 8px 0; }
      th, td { padding: 6px 8px; border: 1px solid #eee; text-align: left; }
      th { background: #f5f5f5; }
      .pass { color: #16a34a; font-weight: 600; }
      .fail { color: #dc2626; font-weight: 600; }
      .skip { color: #f59e0b; font-weight: 600; }
      .tc-block { border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin: 12px 0; page-break-inside: avoid; }
      .api-entry { background: #f9f9f9; border-left: 3px solid #6366f1; padding: 8px; margin: 6px 0; font-size: 12px; }
      pre { background: #f5f5f5; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
      img { max-width: 100%; border: 1px solid #eee; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin: 4px 0; }
      .screenshot-step { margin: 8px 0; }
      .meta-table td:first-child { font-weight: 600; width: 200px; }
      hr { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }
    </style>
  `;

  // Section 1: Run Information
  let runInfoHtml = '<h2>1. E2E Run Information</h2>';
  if (runInfo) {
    runInfoHtml += '<table class="meta-table">';
    runInfoHtml += `<tr><td>Project</td><td>${escapeHtml(runInfo.project ?? 'TalentOS')}</td></tr>`;
    runInfoHtml += `<tr><td>Environment</td><td>${escapeHtml(runInfo.environment ?? 'local')}</td></tr>`;
    runInfoHtml += `<tr><td>Run ID</td><td>${escapeHtml(runId)}</td></tr>`;
    runInfoHtml += `<tr><td>Started At</td><td>${escapeHtml(runInfo.startedAt ?? '—')}</td></tr>`;
    runInfoHtml += `<tr><td>GitHub Workflow</td><td>${escapeHtml(runInfo.ci?.workflow ?? 'N/A (local run)')}</td></tr>`;
    runInfoHtml += `<tr><td>GitHub Job</td><td>${escapeHtml(runInfo.ci?.job ?? 'N/A (local run)')}</td></tr>`;
    runInfoHtml += `<tr><td>GitHub Run ID</td><td>${escapeHtml(runInfo.ci?.runId ?? 'N/A (local run)')}</td></tr>`;
    runInfoHtml += `<tr><td>PR Number</td><td>${escapeHtml(String(runInfo.ci?.prNumber ?? 'N/A (local run)'))}</td></tr>`;
    runInfoHtml += `<tr><td>Branch / Ref</td><td>${escapeHtml(runInfo.ci?.ref ?? 'N/A (local run)')}</td></tr>`;
    runInfoHtml += `<tr><td>Commit SHA</td><td>${escapeHtml(runInfo.ci?.sha ?? 'N/A (local run)')}</td></tr>`;
    runInfoHtml += `<tr><td>Event</td><td>${escapeHtml(runInfo.ci?.eventName ?? 'N/A (local run)')}</td></tr>`;
    runInfoHtml += `<tr><td>Node.js Version</td><td>${escapeHtml(runInfo.nodeVersion ?? process.version)}</td></tr>`;
    runInfoHtml += `<tr><td>Playwright</td><td>Chromium (via @playwright/test)</td></tr>`;
    runInfoHtml += `<tr><td>Regression Command</td><td>${escapeHtml(runInfo.command ?? 'npm run regression:all')}</td></tr>`;
    runInfoHtml += `<tr><td>Total Scenarios</td><td>${total}</td></tr>`;
    runInfoHtml += `<tr><td>Passed</td><td class="pass">${passed}</td></tr>`;
    runInfoHtml += `<tr><td>Failed</td><td class="${failed > 0 ? 'fail' : ''}">${failed}</td></tr>`;
    runInfoHtml += `<tr><td>Skipped</td><td class="${skipped > 0 ? 'skip' : ''}">${skipped}</td></tr>`;
    runInfoHtml += `<tr><td>Total Duration</td><td>${seconds(s.durationMs)}</td></tr>`;
    runInfoHtml += '</table>';
  } else {
    runInfoHtml += '<p>No run-info.json found.</p>';
  }

  // Section 2: Overall Summary
  const verdict = failed > 0 ? `<span class="fail">FAILED</span>` : `<span class="pass">PASSED</span>`;
  const summaryHtml = `<h2>2. Overall Summary</h2><p>${verdict} — ${passed}/${total} passed · ${failed} failed · ${skipped} skipped · ${seconds(s.durationMs)}</p>`;

  // Section 3: Test Case Matrix
  let matrixHtml = '<h2>3. Test Case Matrix</h2>';
  matrixHtml += '<table><thead><tr><th>TC ID</th><th>Area</th><th>Scenario</th><th>Status</th><th>Duration</th><th>Source</th></tr></thead><tbody>';
  for (const r of results) {
    const id = tcId(r.area, r.name);
    const cls = r.status === 'passed' ? 'pass' : r.status === 'failed' ? 'fail' : 'skip';
    const sc = scenarioEvidence[id];
    matrixHtml += `<tr><td>${escapeHtml(id)}</td><td>${escapeHtml(r.area)}</td><td>${escapeHtml(r.name)}</td><td class="${cls}">${escapeHtml(r.status.toUpperCase())}</td><td>${seconds(r.durationMs)}</td><td>${escapeHtml(sc?.sourceFile ?? 'scripts/regression/run.ts')}</td></tr>`;
  }
  matrixHtml += '</tbody></table>';

  // Section 3b: UI Screenshot Journeys
  let journeysHtml = '<h2>3b. UI Screenshot Journeys</h2>';
  journeysHtml += '<p>Screenshots grouped by logical user journey, preserving real execution order. Each step maps to its Test Case ID where a regression scenario covers that flow.</p>';
  const journeys = screenshotMap.journeys ?? [];
  if (journeys.length === 0) {
    journeysHtml += '<p>No screenshot journeys defined.</p>';
  } else {
    for (const journey of journeys) {
      journeysHtml += `<div class="tc-block">`;
      journeysHtml += `<h3>${escapeHtml(journey.name)}</h3>`;
      journeysHtml += `<p style="color:#666">${escapeHtml(journey.description)}</p>`;
      for (const step of journey.steps) {
        const imgPath = join(screenshotsDir, step.file);
        const dataUri = embedImageAsDataUri(imgPath);
        if (dataUri) {
          journeysHtml += `<div class="screenshot-step">`;
          journeysHtml += `<p><strong>Step ${step.step}</strong>: ${escapeHtml(step.caption)} — ${escapeHtml(step.file)}`;
          if (step.tcId) {
            journeysHtml += ` <span style="background:#e0e7ff;padding:2px 6px;border-radius:3px;font-size:11px">${escapeHtml(step.tcId)}</span>`;
          } else {
            journeysHtml += ` <span style="background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:11px;color:#888">Documentation only</span>`;
          }
          journeysHtml += `</p>`;
          journeysHtml += `<img src="${dataUri}"/>`;
          journeysHtml += `</div>`;
        }
      }
      journeysHtml += `</div>`;
    }
  }

  // Section 4: Detailed Evidence By Test Case
  let detailHtml = '<h2>4. Detailed Evidence By Test Case</h2>';
  for (const r of results) {
    const id = tcId(r.area, r.name);
    const slug = scenarioSlug(r.area, r.name);
    const sc = scenarioEvidence[id];
    const cls = r.status === 'passed' ? 'pass' : r.status === 'failed' ? 'fail' : 'skip';

    detailHtml += `<div class="tc-block">`;
    detailHtml += `<h3>${escapeHtml(id)}</h3>`;
    detailHtml += `<h4>Area: ${escapeHtml(r.area)} | Scenario: ${escapeHtml(r.name)}</h4>`;

    const expectedText = sc?.expected ?? deriveExpected(r);
    const actualText = sc?.actual ?? r.detail ?? r.error ?? deriveActual(r);
    detailHtml += `<p><strong>Expected:</strong> ${escapeHtml(expectedText)}</p>`;
    detailHtml += `<p><strong>Actual:</strong> ${escapeHtml(actualText)}</p>`;
    detailHtml += `<p><strong>Result:</strong> <span class="${cls}">${escapeHtml((sc?.result ?? r.status).toUpperCase())}</span></p>`;

    // API Evidence
    const httpEntries = httpEvidence[slug] ?? [];
    if (httpEntries.length > 0) {
      detailHtml += '<h4>API Request/Response Evidence</h4>';
      httpEntries.forEach((entry, i) => {
        detailHtml += `<div class="api-entry">`;
        detailHtml += `<p><strong>API #${i + 1}</strong> ${escapeHtml(entry.request?.method ?? '?')} ${escapeHtml(maskSensitive(entry.request?.url ?? '?'))}</p>`;
        if (entry.request?.headers && Object.keys(entry.request.headers).length > 0) {
          detailHtml += '<p>Request headers:</p>';
          detailHtml += `<pre>${escapeHtml(maskSensitive(JSON.stringify(entry.request.headers, null, 2)))}</pre>`;
        }
        if (entry.request?.body) {
          detailHtml += '<p>Request body:</p>';
          detailHtml += `<pre>${escapeHtml(truncateBody(entry.request.body))}</pre>`;
        }
        detailHtml += `<p>Response: HTTP ${escapeHtml(String(entry.response?.status ?? '?'))} ${escapeHtml(entry.response?.statusText ?? '')}</p>`;
        if (entry.response?.headers && Object.keys(entry.response.headers).length > 0) {
          detailHtml += '<p>Response headers:</p>';
          detailHtml += `<pre>${escapeHtml(maskSensitive(JSON.stringify(entry.response.headers, null, 2)))}</pre>`;
        }
        if (entry.response?.body) {
          detailHtml += '<p>Response body:</p>';
          detailHtml += `<pre>${escapeHtml(truncateBody(entry.response.body))}</pre>`;
        } else {
          detailHtml += '<p>Response body: &lt;empty&gt;</p>';
        }
        if (entry.durationMs != null) detailHtml += `<p>Duration: ${entry.durationMs}ms | Timestamp: ${escapeHtml(entry.timestamp)}</p>`;
        detailHtml += `</div>`;
      });
    } else {
      detailHtml += '<h4>API Evidence: No HTTP calls captured (DB/unit evidence).</h4>';
    }

    // Screenshots
    const mappedShots = screenshotMap.mapped?.[id] ?? [];
    if (mappedShots.length > 0) {
      detailHtml += '<h4>UI Screenshots</h4>';
      for (const ms of mappedShots) {
        const imgPath = join(screenshotsDir, ms.file);
        const dataUri = embedImageAsDataUri(imgPath);
        if (dataUri) {
          detailHtml += `<div class="screenshot-step"><p>Step ${ms.step}: ${escapeHtml(ms.caption)} — ${escapeHtml(ms.file)}</p><img src="${dataUri}"/></div>`;
        }
      }
    }

    // Traceability
    detailHtml += '<h4>Traceability</h4><ul>';
    detailHtml += `<li>TC ID: ${escapeHtml(id)}</li>`;
    detailHtml += `<li>Area: ${escapeHtml(r.area)}</li>`;
    detailHtml += `<li>Scenario: ${escapeHtml(r.name)}</li>`;
    detailHtml += `<li>Source: ${escapeHtml(sc?.sourceFile ?? 'scripts/regression/run.ts')}</li>`;
    detailHtml += `<li>Execution: regression run ${escapeHtml(runId)}</li>`;
    if (httpEntries.length > 0) detailHtml += `<li>API Evidence: http-evidence-${escapeHtml(slug)}.json (${httpEntries.length} entries)</li>`;
    if (mappedShots.length > 0) detailHtml += `<li>Screenshots: ${mappedShots.map((m) => m.file).join(', ')}</li>`;
    detailHtml += `</ul></div>`;
  }

  // Section 5: Negative/Error Scenario Evidence
  let negativeHtml = '<h2>5. Negative / Error Scenario Evidence</h2>';
  const failures = results.filter((r) => r.status === 'failed');
  const negatives = results.filter((r) => {
    const n = r.name.toLowerCase();
    return n.includes('cannot') || n.includes('reject') || n.includes('denied') || n.includes('blocks') || n.includes('invalid') || n.includes('failed') || n.includes('error');
  });
  const allNeg = [...new Set([...failures, ...negatives])];
  if (allNeg.length === 0) {
    negativeHtml += '<p>No failed or negative scenarios in this run.</p>';
  } else {
    for (const r of allNeg) {
      const id = tcId(r.area, r.name);
      const sc = scenarioEvidence[id];
      const slug = scenarioSlug(r.area, r.name);
      const cls = r.status === 'passed' ? 'pass' : 'fail';
      negativeHtml += `<div class="tc-block"><h3>${escapeHtml(id)} — ${escapeHtml(r.name)}</h3>`;
      negativeHtml += `<p><strong>Expected:</strong> ${escapeHtml(sc?.expected ?? deriveExpected(r))}</p>`;
      negativeHtml += `<p><strong>Actual:</strong> ${escapeHtml(sc?.actual ?? r.detail ?? r.error ?? deriveActual(r))}</p>`;
      negativeHtml += `<p><strong>Result:</strong> <span class="${cls}">${escapeHtml(r.status.toUpperCase())}</span></p>`;
      if (r.error) negativeHtml += `<p><strong>Error:</strong></p><pre>${escapeHtml(maskSensitive(r.error))}</pre>`;
      const httpEntries = httpEvidence[slug] ?? [];
      if (httpEntries.length > 0) {
        negativeHtml += '<h4>API Request/Response Evidence</h4>';
        httpEntries.forEach((entry, i) => {
          negativeHtml += `<div class="api-entry">`;
          negativeHtml += `<p><strong>API #${i + 1}</strong> ${escapeHtml(entry.request?.method ?? '?')} ${escapeHtml(maskSensitive(entry.request?.url ?? '?'))}</p>`;
          if (entry.request?.headers && Object.keys(entry.request.headers).length > 0) {
            negativeHtml += '<p>Request headers:</p>';
            negativeHtml += `<pre>${escapeHtml(maskSensitive(JSON.stringify(entry.request.headers, null, 2)))}</pre>`;
          }
          if (entry.request?.body) {
            negativeHtml += '<p>Request body:</p>';
            negativeHtml += `<pre>${escapeHtml(truncateBody(entry.request.body))}</pre>`;
          }
          negativeHtml += `<p>Response: HTTP ${escapeHtml(String(entry.response?.status ?? '?'))} ${escapeHtml(entry.response?.statusText ?? '')}</p>`;
          if (entry.response?.body) {
            negativeHtml += '<p>Response body:</p>';
            negativeHtml += `<pre>${escapeHtml(truncateBody(entry.response.body))}</pre>`;
          } else {
            negativeHtml += '<p>Response body: &lt;empty&gt;</p>';
          }
          if (entry.durationMs != null) negativeHtml += `<p>Duration: ${entry.durationMs}ms | Timestamp: ${escapeHtml(entry.timestamp)}</p>`;
          negativeHtml += `</div>`;
        });
      }
      const mappedShots = screenshotMap.mapped?.[id] ?? [];
      if (mappedShots.length > 0) {
        for (const ms of mappedShots) {
          const imgPath = join(screenshotsDir, ms.file);
          const dataUri = embedImageAsDataUri(imgPath);
          if (dataUri) negativeHtml += `<img src="${dataUri}"/>`;
        }
      }
      negativeHtml += `</div>`;
    }
  }

  // Section 6: Known Gaps
  let gapsHtml = '<h2>6. Known Gaps / Pending Items</h2>';
  if (gaps.length === 0) {
    gapsHtml += '<p>No skipped or blocked scenarios.</p>';
  } else {
    gapsHtml += '<table><thead><tr><th>TC ID</th><th>Scenario</th><th>Status</th><th>Reason</th></tr></thead><tbody>';
    for (const g of gaps) {
      gapsHtml += `<tr><td>${escapeHtml(g.id)}</td><td>${escapeHtml(g.scenario)}</td><td class="skip">${escapeHtml(g.status)}</td><td>${escapeHtml(g.reason)}</td></tr>`;
    }
    gapsHtml += '</tbody></table>';
  }

  // Section 7: Evidence Files + SHA256
  let checksumHtml = '<h2>7. Evidence Files + SHA256 Checksums</h2>';
  const evidenceFiles: string[] = [];
  if (existsSync(evidenceDir)) {
    for (const f of readdirSync(evidenceDir)) evidenceFiles.push(join(evidenceDir, f));
  }
  if (existsSync(screenshotsDir)) {
    for (const f of readdirSync(screenshotsDir)) {
      if (/\.(png|jpg|jpeg)$/.test(f)) evidenceFiles.push(join(screenshotsDir, f));
    }
  }
  if (file) evidenceFiles.push(file);

  checksumHtml += '<table><thead><tr><th>File</th><th>SHA256</th></tr></thead><tbody>';
  for (const ef of evidenceFiles.sort()) {
    checksumHtml += `<tr><td>${escapeHtml(basename(ef))}</td><td><code>${escapeHtml(sha256(ef))}</code></td></tr>`;
  }
  checksumHtml += '</tbody></table>';

  if (screenshotMap.unmapped && screenshotMap.unmapped.length > 0) {
    checksumHtml += '<h3>Unmapped Screenshots (Documentation Only)</h3><ul>';
    for (const u of screenshotMap.unmapped) {
      checksumHtml += `<li>${escapeHtml(u.file)} — ${escapeHtml(u.note)}</li>`;
    }
    checksumHtml += '</ul>';
  }

  // ── Assemble full HTML ──────────────────────────────────────────────────────
  const fullHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>E2E Evidence Report ${escapeHtml(runId)}</title>${css}</head>
<body>
  <h1>E2E Evidence Report — TalentOS</h1>
  <p>Run: ${escapeHtml(runId)} · Generated: ${new Date().toISOString()}</p>
  <hr/>
  ${runInfoHtml}
  ${summaryHtml}
  ${matrixHtml}
  ${journeysHtml}
  ${detailHtml}
  ${negativeHtml}
  ${gapsHtml}
  ${checksumHtml}
</body></html>`;

  const htmlPath = join(outDir, `e2e-report-${runId}.html`);
  writeFileSync(htmlPath, fullHtml, 'utf8');
  console.log('Wrote HTML report to', htmlPath);

  const pdfPath = join(outDir, `e2e-report-${runId}.pdf`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    console.log('Wrote PDF report to', pdfPath);
  } finally {
    await browser.close();
  }
}

render().catch((err) => { console.error(err); process.exit(1); });
