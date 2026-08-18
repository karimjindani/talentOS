// Pure, dependency-free helpers for the middleware request log (v0.20.2, D-102). Kept out of the
// app middlewares so the enable rule and the noise filter can be unit-tested without next-auth.
//
// Request logging arrived in v0.20.1 as an unconditional `console.log` in both middlewares. Two
// problems: it ran in every environment with no way to turn it off, and the middleware matcher only
// excludes `_next/static`, `_next/image` and `favicon.ico` — so `/_next/data` payloads and every
// file served from `public/` each produced a line, burying real navigations.

/** Opt-in flag. Unset means off, so a deployed environment is quiet unless it asks for the log. */
const REQUEST_LOG_ENV_VAR = "REQUEST_LOG";

/**
 * True when request logging is switched on.
 *
 * Deliberately an explicit flag rather than a `NODE_ENV !== "production"` check: the local Docker
 * stack runs the apps with `NODE_ENV: production` (docker-compose.yml), so an environment-inferred
 * default would silence the log in the one place it is actually read — `docker compose logs`.
 * `docker-compose.yml` sets `REQUEST_LOG: "1"` for the local stack instead.
 */
export function isRequestLogEnabled(env: Record<string, string | undefined>): boolean {
  return env[REQUEST_LOG_ENV_VAR] === "1";
}

/** Assets that reach middleware but say nothing about user activity. */
const STATIC_FILE_EXTENSION = /\.(?:css|js|mjs|map|json|txt|xml|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot)$/i;

/**
 * True when a path is worth a log line. Filters Next's data/HMR payloads and static files from
 * `public/`, both of which the middleware matcher still lets through.
 *
 * Note `/api/auth/session` is intentionally *not* filtered: next-auth polls it, so it is noisy, but
 * it is a real request and hiding it would misrepresent traffic.
 */
export function shouldLogRequest(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return false;
  return !STATIC_FILE_EXTENSION.test(pathname);
}

export type RequestLogFields = {
  /** Which portal emitted the line, e.g. `applicant` or `admin`. */
  app: string;
  method: string;
  pathname: string;
  tenantSlug: string;
  authenticated: boolean;
  /** Injected so the formatter stays pure and testable. */
  timestamp: Date;
};

/** Renders one log line. Matches the repo's `[prefix] …` console convention. */
export function formatRequestLog(fields: RequestLogFields): string {
  const { app, method, pathname, tenantSlug, authenticated, timestamp } = fields;
  return `[${app}] ${timestamp.toISOString()} ${method} ${pathname} tenant=${tenantSlug} auth=${authenticated}`;
}

/**
 * Write a request log line when the flag is on and the path is worth recording.
 *
 * Never throws: an observability concern must not be able to break the auth middleware that hosts
 * it, so a failing `console.log` (a closed stdout in a torn-down container) is swallowed.
 */
export function logRequest(
  fields: Omit<RequestLogFields, "timestamp"> & { timestamp?: Date },
  env: Record<string, string | undefined> = process.env
): void {
  if (!isRequestLogEnabled(env)) return;
  if (!shouldLogRequest(fields.pathname)) return;
  try {
    console.log(formatRequestLog({ ...fields, timestamp: fields.timestamp ?? new Date() }));
  } catch {
    // Logging must never fail a request.
  }
}
