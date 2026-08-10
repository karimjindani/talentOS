/**
 * Build an absolute callback URL from a raw callbackUrl param.
 *
 * When the callbackUrl is already absolute (e.g. set by middleware), use it as-is.
 * Otherwise, prefix it with the current browser origin so the post-login redirect
 * returns the user to their own tenant subdomain rather than the canonical AUTH_URL host.
 *
 * Extracted from the login page component so it can be unit-tested without a DOM.
 * `window` is only available in the browser; this function must be called at click time,
 * never during server-side rendering.
 */
export function resolveCallbackUrl(
  rawCallbackUrl: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : ""
): string {
  if (rawCallbackUrl.startsWith("http://") || rawCallbackUrl.startsWith("https://")) {
    return rawCallbackUrl;
  }
  return `${origin}${rawCallbackUrl}`;
}
