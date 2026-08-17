import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type CaptureEntry = {
  timestamp: string;
  scenario?: string | null;
  request?: { method?: string; url?: string; headers?: Record<string, string>; body?: string | null };
  response?: { status?: number | null; statusText?: string | null; headers?: Record<string, string>; bodySize?: number | null; body?: string | null; error?: string | null };
  durationMs?: number;
};

const MAX_BODY = 20000;
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token']);

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

let _runId: string | undefined;
let _outDir = '.ops/evidence';
let _currentScenario: string | null = null;
let _buffer: CaptureEntry[] = [];
let _installed = false;
let _origFetch: typeof fetch | undefined;

function safeStringifyHeaders(headers: any): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    if (!headers) return out;
    if (typeof headers.forEach === 'function') {
      headers.forEach((v: string, k: string) => (out[k] = v));
      return out;
    }
    if (typeof headers.entries === 'function') {
      for (const [k, v] of headers.entries()) out[k] = String(v);
      return out;
    }
    // plain object
    for (const k of Object.keys(headers)) out[k] = String((headers as any)[k]);
  } catch (e) {
    // ignore
  }
  return out;
}

export function setCurrentScenario(id: string | null) {
  _currentScenario = id;
}

export function installNodeHttpCapture(opts: { runId?: string; outDir?: string } = {}) {
  if (opts.runId) _runId = opts.runId;
  if (opts.outDir) _outDir = opts.outDir;
  if (_installed) return;
  _installed = true;
  try {
    if (typeof (globalThis as any).fetch !== 'function') return;
    _origFetch = (globalThis as any).fetch.bind(globalThis) as typeof fetch;
    (globalThis as any).fetch = async function (input: any, init?: any) {
      const start = Date.now();
      const entry: CaptureEntry = { timestamp: new Date().toISOString(), scenario: _currentScenario };
      try {
        // request
        const url = typeof input === 'string' ? input : (input && input.url) || String(input);
        const method = (init && init.method) || (input && input.method) || 'GET';
        entry.request = { method, url: String(url), headers: redactHeaders(safeStringifyHeaders((init && init.headers) || (input && input.headers))), body: null };
        if (init && init.body != null) {
          try {
            entry.request.body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
          } catch {
            entry.request.body = '[unserializable]';
          }
        }

        const resp = await _origFetch!(input, init);

        entry.durationMs = Date.now() - start;
        const respHeaders = safeStringifyHeaders(resp.headers);
        entry.response = { status: resp.status, statusText: resp.statusText, headers: redactHeaders(respHeaders), bodySize: null, body: null };
        // try to capture response body text via clone (safe, does not consume original)
        try {
          const cloned = resp.clone?.();
          if (cloned && typeof cloned.text === 'function') {
            const text = await cloned.text();
            entry.response.bodySize = text.length;
            entry.response.body = text.length > MAX_BODY ? text.slice(0, MAX_BODY) + '\n[TRUNCATED]' : text;
          }
        } catch {
          entry.response.bodySize = null;
          entry.response.body = null;
        }

        _buffer.push(entry);
        return resp;
      } catch (err: any) {
        entry.durationMs = Date.now() - start;
        entry.response = { error: String(err?.message ?? err) } as any;
        _buffer.push(entry);
        throw err;
      }
    } as any;
  } catch (e) {
    // do not let instrumentation throw
  }
}

function sanitizeFilename(s: string) {
  return s.replace(/[^a-z0-9\-_\.]/gi, '_').slice(0, 200);
}

export async function flushEvidence() {
  if (!_runId) _runId = `run-${Date.now()}`;
  const dir = join(_outDir, _runId);
  try {
    await mkdir(dir, { recursive: true });
  } catch {}
  if (_buffer.length === 0) return;
  // group by scenario
  const groups: Record<string, CaptureEntry[]> = {};
  for (const e of _buffer) {
    const k = e.scenario ?? '__global';
    groups[k] = groups[k] || [];
    groups[k].push(e);
  }
  for (const k of Object.keys(groups)) {
    const file = join(dir, `http-evidence-${sanitizeFilename(k)}.json`);
    try {
      await writeFile(file, JSON.stringify({ runId: _runId, scenario: k, entries: groups[k] }, null, 2), 'utf8');
    } catch (e) {
      // ignore write errors
    }
  }
  _buffer = [];
}
