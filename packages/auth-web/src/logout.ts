export type EndSessionUrlInput = {
  issuer: string;
  idToken?: string | null;
  clientId?: string;
  postLogoutRedirectUri: string;
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
  postLogoutRedirectUri
}: EndSessionUrlInput): string {
  const url = new URL(`${issuer.replace(/\/$/, "")}/protocol/openid-connect/logout`);
  url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
  if (idToken) {
    url.searchParams.set("id_token_hint", idToken);
  } else if (clientId) {
    url.searchParams.set("client_id", clientId);
  }
  return url.toString();
}
