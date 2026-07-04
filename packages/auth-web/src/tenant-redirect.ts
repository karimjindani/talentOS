// Pure, dependency-free helpers for the multi-tenant post-login/logout redirect boundary
// (v0.12.1, D-060). Kept out of `auth.ts` so they can be unit-tested without importing next-auth.

/** True when `hostname` is the base domain itself or one of its subdomains (never a look-alike suffix). */
export function isSameBaseDomain(hostname: string, baseDomain: string): boolean {
  return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
}

/**
 * Decide the post-login/logout landing URL. Allows the AUTH_URL origin (same host) and — so a user
 * can be returned to their own tenant subdomain after the canonical-host login — any subdomain of
 * `baseDomain`. Anything else collapses to `baseUrl`, so this is an allow-list, not an open redirect.
 */
export function resolveTenantRedirect(url: string, baseUrl: string, baseDomain?: string): string {
  try {
    const target = new URL(url, baseUrl);
    if (target.origin === baseUrl) return target.toString();
    if (baseDomain && baseDomain !== "localhost" && isSameBaseDomain(target.hostname, baseDomain)) {
      return target.toString();
    }
    return baseUrl;
  } catch {
    return baseUrl;
  }
}
