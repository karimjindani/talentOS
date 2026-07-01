import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(appDir, "../../..");
export const OPS_RUNS_DIR = resolve(REPO_ROOT, ".ops/runs");
export const OPS_CONFIG_FILE = resolve(REPO_ROOT, ".ops/config.json");

export type OpsKeycloakClient = {
  clientId: string;
  clientSecret: string;
};

let envLoaded = false;

export type OpsConfig = {
  host: string;
  port: number;
  repoRoot: string;
  baseUrl: string;
  sessionSecret: string;
  sessionCookieName: string;
  loginCookieName: string;
  sessionMaxAgeSeconds: number;
  allowedRoles: string[];
  keycloak: {
    issuer: string;
    browserIssuer: string;
    redirectUri: string;
    normalClient: OpsKeycloakClient;
    mfaClient: OpsKeycloakClient;
  };
};

export function loadDotEnv(envPath = resolve(REPO_ROOT, ".env")) {
  if (envLoaded || !existsSync(envPath)) {
    envLoaded = true;
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  envLoaded = true;
}

export function getOpsConfig(): OpsConfig {
  loadDotEnv();
  const port = Number(process.env.OPS_PORT ?? 3300);
  const host = process.env.OPS_HOST ?? "127.0.0.1";
  const resolvedPort = Number.isFinite(port) ? port : 3300;
  const baseUrl = trimTrailingSlash(process.env.OPS_BASE_URL ?? `http://${host}:${resolvedPort}`);
  const issuer = trimTrailingSlash(process.env.KEYCLOAK_ISSUER ?? "http://host.docker.internal:8080/realms/talentos");
  return {
    host,
    port: resolvedPort,
    repoRoot: REPO_ROOT,
    baseUrl,
    sessionSecret: process.env.OPS_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? "local-ops-session-secret",
    sessionCookieName: "talentos_ops_session",
    loginCookieName: "talentos_ops_login",
    sessionMaxAgeSeconds: Number(process.env.OPS_SESSION_MAX_AGE_SECONDS ?? 8 * 60 * 60),
    allowedRoles: parseList(process.env.OPS_ALLOWED_ROLES ?? "SUPER_ADMIN,ORG_ADMIN"),
    keycloak: {
      issuer,
      browserIssuer: trimTrailingSlash(
        process.env.OPS_KEYCLOAK_BROWSER_ISSUER ??
          process.env.KEYCLOAK_BROWSER_ISSUER ??
          issuer
      ),
      redirectUri: process.env.OPS_KEYCLOAK_REDIRECT_URI ?? `${baseUrl}/auth/callback`,
      normalClient: {
        clientId: process.env.OPS_KEYCLOAK_CLIENT_ID ?? "talentos-ops",
        clientSecret: process.env.OPS_KEYCLOAK_CLIENT_SECRET ?? "talentos-ops-secret"
      },
      mfaClient: {
        clientId: process.env.OPS_KEYCLOAK_MFA_CLIENT_ID ?? "talentos-ops-mfa",
        clientSecret: process.env.OPS_KEYCLOAK_MFA_CLIENT_SECRET ?? "talentos-ops-mfa-secret"
      }
    }
  };
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
