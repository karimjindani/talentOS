import { createHash, randomBytes, createSecretKey } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { OpsConfig, OpsKeycloakClient } from "./config";
import { canAccessOpsConsole, extractRealmRoles, primaryOpsRole } from "./security";

export type OpsSession = {
  email: string;
  name?: string | null;
  roles: string[];
  primaryRole: string;
  clientId: string;
  authenticatedAt: string;
};

export type OpsLoginState = {
  state: string;
  nonce: string;
  codeVerifier: string;
  clientId: string;
  mfaRequired: boolean;
};

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export function selectOpsClient(config: OpsConfig, mfaEnabled: boolean): OpsKeycloakClient {
  return mfaEnabled ? config.keycloak.mfaClient : config.keycloak.normalClient;
}

export async function buildLoginRedirect(config: OpsConfig, mfaEnabled: boolean) {
  const client = selectOpsClient(config, mfaEnabled);
  const loginState: OpsLoginState = {
    state: randomBase64Url(32),
    nonce: randomBase64Url(32),
    codeVerifier: randomBase64Url(64),
    clientId: client.clientId,
    mfaRequired: mfaEnabled
  };
  const codeChallenge = base64Url(createHash("sha256").update(loginState.codeVerifier).digest());
  const url = new URL(`${config.keycloak.browserIssuer}/protocol/openid-connect/auth`);
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile roles");
  url.searchParams.set("redirect_uri", config.keycloak.redirectUri);
  url.searchParams.set("state", loginState.state);
  url.searchParams.set("nonce", loginState.nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (mfaEnabled) {
    url.searchParams.set("prompt", "login");
  }

  return { url, loginState };
}

export async function completeLogin(
  config: OpsConfig,
  query: URLSearchParams,
  loginState: OpsLoginState
): Promise<OpsSession> {
  const state = query.get("state");
  const code = query.get("code");
  if (!state || state !== loginState.state) {
    throw new Error("Invalid Keycloak login state.");
  }
  if (!code) {
    throw new Error(query.get("error_description") ?? query.get("error") ?? "Keycloak did not return an auth code.");
  }

  const client = clientById(config, loginState.clientId);
  const tokens = await exchangeAuthorizationCode(config, client, code, loginState.codeVerifier);
  if (!tokens.id_token) {
    throw new Error("Keycloak did not return an ID token.");
  }
  if (!tokens.access_token) {
    throw new Error("Keycloak did not return an access token.");
  }

  const claims = await verifyIdToken(config, client.clientId, tokens.id_token, loginState.nonce);
  const accessClaims = await verifyAccessToken(config, tokens.access_token);
  const roles = extractRealmRoles(accessClaims as JWTPayload & { realm_access?: { roles?: unknown } });
  if (!canAccessOpsConsole(roles, config.allowedRoles)) {
    throw new Error("Your Keycloak role is not allowed to use Local Operations.");
  }
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!email) {
    throw new Error("Keycloak did not return an email claim.");
  }

  return {
    email,
    name: typeof claims.name === "string" ? claims.name : null,
    roles,
    primaryRole: primaryOpsRole(roles, config.allowedRoles) ?? roles[0] ?? "UNKNOWN",
    clientId: client.clientId,
    authenticatedAt: new Date().toISOString()
  };
}

export async function createSessionCookieValue(config: OpsConfig, session: OpsSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${config.sessionMaxAgeSeconds}s`)
    .setSubject(session.email)
    .sign(sessionKey(config));
}

export async function readSession(config: OpsConfig, req: IncomingMessage): Promise<OpsSession | null> {
  const token = parseCookies(req.headers.cookie)[config.sessionCookieName];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(config));
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is string => typeof role === "string")
      : [];
    const email = typeof payload.email === "string" ? payload.email : null;
    const primaryRole = typeof payload.primaryRole === "string" ? payload.primaryRole : null;
    const clientId = typeof payload.clientId === "string" ? payload.clientId : null;
    const authenticatedAt = typeof payload.authenticatedAt === "string" ? payload.authenticatedAt : null;
    if (!email || !primaryRole || !clientId || !authenticatedAt) return null;
    if (!canAccessOpsConsole(roles, config.allowedRoles)) return null;
    return {
      email,
      name: typeof payload.name === "string" ? payload.name : null,
      roles,
      primaryRole,
      clientId,
      authenticatedAt
    };
  } catch {
    return null;
  }
}

export async function createLoginCookieValue(config: OpsConfig, loginState: OpsLoginState): Promise<string> {
  return new SignJWT({ ...loginState })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(sessionKey(config));
}

export async function readLoginState(config: OpsConfig, req: IncomingMessage): Promise<OpsLoginState | null> {
  const token = parseCookies(req.headers.cookie)[config.loginCookieName];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(config));
    const state = typeof payload.state === "string" ? payload.state : null;
    const nonce = typeof payload.nonce === "string" ? payload.nonce : null;
    const codeVerifier = typeof payload.codeVerifier === "string" ? payload.codeVerifier : null;
    const clientId = typeof payload.clientId === "string" ? payload.clientId : null;
    const mfaRequired = payload.mfaRequired === true;
    if (!state || !nonce || !codeVerifier || !clientId) return null;
    return { state, nonce, codeVerifier, clientId, mfaRequired };
  } catch {
    return null;
  }
}

export function sessionCookie(config: OpsConfig, value: string) {
  return serializeCookie(config.sessionCookieName, value, config.sessionMaxAgeSeconds);
}

export function loginCookie(config: OpsConfig, value: string) {
  return serializeCookie(config.loginCookieName, value, 10 * 60);
}

export function clearSessionCookie(config: OpsConfig) {
  return serializeCookie(config.sessionCookieName, "", 0);
}

export function clearLoginCookie(config: OpsConfig) {
  return serializeCookie(config.loginCookieName, "", 0);
}

export function buildLogoutUrl(config: OpsConfig, clientId: string) {
  const url = new URL(`${config.keycloak.browserIssuer}/protocol/openid-connect/logout`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("post_logout_redirect_uri", config.baseUrl);
  return url;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  return parts.join("; ");
}

async function exchangeAuthorizationCode(
  config: OpsConfig,
  client: OpsKeycloakClient,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await fetch(`${config.keycloak.browserIssuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.keycloak.redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code_verifier: codeVerifier
    })
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? `Token exchange failed with HTTP ${response.status}.`);
  }
  return payload;
}

async function verifyIdToken(config: OpsConfig, audience: string, idToken: string, nonce: string): Promise<JWTPayload> {
  const jwks = createRemoteJWKSet(new URL(`${config.keycloak.browserIssuer}/protocol/openid-connect/certs`));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: config.keycloak.issuer,
    audience
  });
  if (payload.nonce !== nonce) {
    throw new Error("Invalid Keycloak nonce.");
  }
  return payload;
}

async function verifyAccessToken(config: OpsConfig, accessToken: string): Promise<JWTPayload> {
  const jwks = createRemoteJWKSet(new URL(`${config.keycloak.browserIssuer}/protocol/openid-connect/certs`));
  const { payload } = await jwtVerify(accessToken, jwks, {
    issuer: config.keycloak.issuer
  });
  return payload;
}

function clientById(config: OpsConfig, clientId: string): OpsKeycloakClient {
  const clients = [config.keycloak.normalClient, config.keycloak.mfaClient];
  const client = clients.find((candidate) => candidate.clientId === clientId);
  if (!client) throw new Error("Unknown Ops Keycloak client.");
  return client;
}

function sessionKey(config: OpsConfig) {
  return createSecretKey(createHash("sha256").update(config.sessionSecret).digest());
}

function randomBase64Url(bytes: number) {
  return base64Url(randomBytes(bytes));
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
