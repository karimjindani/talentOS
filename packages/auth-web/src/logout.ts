export type EndSessionUrlInput = {
  issuer: string;
  idToken?: string | null;
  clientId?: string;
  postLogoutRedirectUri: string;
  /** OIDC RP-initiated-logout `state`; Keycloak echoes it back on the post-logout redirect. */
  state?: string;
};

/**
 * Build a Keycloak RP-initiated logout URL (OIDC end_session_endpoint). Passing the
 * id_token as id_token_hint terminates the SSO session without a confirmation prompt;
 * client_id is a fallback for sessions created before the id_token was persisted.
 */
export function buildEndSessionUrl({
  issuer,
  idToken,
  clientId,
  postLogoutRedirectUri,
  state
}: EndSessionUrlInput): string {
  const url = new URL(`${issuer.replace(/\/$/, "")}/protocol/openid-connect/logout`);
  url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
  if (state) {
    url.searchParams.set("state", state);
  }
  if (idToken) {
    url.searchParams.set("id_token_hint", idToken);
  } else if (clientId) {
    url.searchParams.set("client_id", clientId);
  }
  return url.toString();
}

export type TenantLogoutUrlInput = {
  issuer: string;
  idToken?: string | null;
  clientId?: string;
  /** Canonical auth origin for this app (the AUTH_URL host), e.g. `http://lvh.me:3100`. */
  authUrl: string;
  /** Origin of the request the user logged out from, e.g. `http://demo.lvh.me:3100`. */
  requestOrigin: string;
};

/**
 * Build the tenant-aware Keycloak logout URL (v0.14.3, D-066). Keycloak validates
 * `post_logout_redirect_uri` against the client's registered patterns, and `*` is only supported at
 * the END of a URI — hostname wildcards like `http://*.lvh.me:3100/*` never match. So a Host-derived
 * redirect URI breaks logout on every tenant subdomain with "Invalid redirect uri". Instead we always
 * return through the canonical AUTH_URL host's `/logged-out` route (the only origin Keycloak can
 * validate) and carry the tenant origin in the OIDC `state` parameter; `/logged-out` then bounces the
 * user back to their tenant via the allow-listed `resolveTenantRedirect` (never an open redirect).
 */
export function buildTenantLogoutUrl({
  issuer,
  idToken,
  clientId,
  authUrl,
  requestOrigin
}: TenantLogoutUrlInput): string {
  const canonicalOrigin = new URL(authUrl).origin;
  return buildEndSessionUrl({
    issuer,
    idToken,
    clientId,
    postLogoutRedirectUri: `${canonicalOrigin}/logged-out`,
    state: `${requestOrigin}/`
  });
}
