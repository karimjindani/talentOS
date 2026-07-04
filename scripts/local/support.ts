import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createHash, randomBytes } from "node:crypto";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const envPath = resolve(repoRoot, ".env");

export const local = {
  baseDomain: "lvh.me",
  keycloakBaseUrl: "http://keycloak.lvh.me:8080",
  keycloakRealm: "talentos",
  minioEndpoint: "http://minio.lvh.me:9000",
  applicantUrl: "http://lvh.me:3100",
  adminUrl: "http://lvh.me:3200",
  tenantApplicantUrl: "http://demo.lvh.me:3100",
  tenantAdminUrl: "http://demo.lvh.me:3200",
  opsUrl: "http://127.0.0.1:3300"
};

export const keycloakIssuer = `${local.keycloakBaseUrl}/realms/${local.keycloakRealm}`;

export function loadEnvFile(path = envPath): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

export function repairLocalEnv() {
  const current = loadEnvFile();
  const postgresPort = current.POSTGRES_PORT || "55432";
  const values: Record<string, string> = {
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_NAME: "TalentOS",
    APP_BASE_DOMAIN: local.baseDomain,
    NEXTAUTH_SECRET: current.NEXTAUTH_SECRET || randomSecret(),
    APPLICANT_PORT: current.APPLICANT_PORT || "3100",
    ADMIN_PORT: current.ADMIN_PORT || "3200",
    NEXTAUTH_URL: local.applicantUrl,
    ADMIN_NEXTAUTH_URL: local.adminUrl,
    NEXT_PUBLIC_APPLICANT_URL: local.applicantUrl,
    KEYCLOAK_PORT: current.KEYCLOAK_PORT || "8080",
    KC_ADMIN: current.KC_ADMIN || "admin",
    KC_ADMIN_PASSWORD: current.KC_ADMIN_PASSWORD || "admin",
    KC_DB_USER: current.KC_DB_USER || "keycloak",
    KC_DB_PASSWORD: current.KC_DB_PASSWORD || "keycloak_dev_password",
    KC_DB_NAME: current.KC_DB_NAME || "keycloak",
    KC_HOSTNAME: local.keycloakBaseUrl,
    KEYCLOAK_ISSUER: keycloakIssuer,
    KEYCLOAK_APPLICANT_CLIENT_ID: "talentos-applicant",
    KEYCLOAK_APPLICANT_CLIENT_SECRET: "talentos-applicant-secret",
    KEYCLOAK_ADMIN_CLIENT_ID: "talentos-admin",
    KEYCLOAK_ADMIN_CLIENT_SECRET: "talentos-admin-secret",
    KEYCLOAK_SERVER_URL: local.keycloakBaseUrl,
    KEYCLOAK_REALM: local.keycloakRealm,
    KEYCLOAK_PROVISIONER_CLIENT_ID: "talentos-provisioner",
    KEYCLOAK_PROVISIONER_CLIENT_SECRET: "talentos-provisioner-secret",
    OPS_KEYCLOAK_CLIENT_ID: "talentos-ops",
    OPS_KEYCLOAK_CLIENT_SECRET: "talentos-ops-secret",
    OPS_KEYCLOAK_MFA_CLIENT_ID: "talentos-ops-mfa",
    OPS_KEYCLOAK_MFA_CLIENT_SECRET: "talentos-ops-mfa-secret",
    POSTGRES_USER: current.POSTGRES_USER || "talentos",
    POSTGRES_PASSWORD: current.POSTGRES_PASSWORD || "talentos_dev_password",
    POSTGRES_DB: current.POSTGRES_DB || "talentos",
    POSTGRES_PORT: postgresPort,
    DATABASE_URL: `postgresql://${current.POSTGRES_USER || "talentos"}:${current.POSTGRES_PASSWORD || "talentos_dev_password"}@localhost:${postgresPort}/${current.POSTGRES_DB || "talentos"}?schema=public`,
    S3_PORT: current.S3_PORT || "9000",
    S3_CONSOLE_PORT: current.S3_CONSOLE_PORT || "9001",
    S3_ENDPOINT: local.minioEndpoint,
    S3_REGION: current.S3_REGION || "us-east-1",
    S3_ACCESS_KEY_ID: current.S3_ACCESS_KEY_ID || "talentos",
    S3_SECRET_ACCESS_KEY: current.S3_SECRET_ACCESS_KEY || "talentos_dev_password",
    S3_BUCKET: current.S3_BUCKET || "talentos",
    S3_FORCE_PATH_STYLE: current.S3_FORCE_PATH_STYLE || "true",
    DEFAULT_TENANT_SLUG: current.DEFAULT_TENANT_SLUG || "demo",
    OPS_HOST: current.OPS_HOST || "127.0.0.1",
    OPS_PORT: current.OPS_PORT || "3300",
    OPS_BASE_URL: local.opsUrl,
    OPS_ALLOWED_ROLES: current.OPS_ALLOWED_ROLES || "SUPER_ADMIN,ORG_ADMIN",
    OPS_SESSION_SECRET: current.OPS_SESSION_SECRET || randomSecret()
  };

  const content = [
    "# TalentOS local runtime file. Generated/repaired by npm.cmd run local:bootstrap.",
    "# This file is ignored by Git.",
    ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
    ""
  ].join("\n");
  writeFileSync(envPath, content, "utf8");
  Object.assign(process.env, values);
}

export async function run(command: string, args: string[] = []) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(commandForPlatform(command, args).command, commandForPlatform(command, args).args, {
      cwd: repoRoot,
      stdio: "inherit"
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

export function stopOpsConsoleIfRunning() {
  if (process.platform !== "win32") return;
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$pids = Get-NetTCPConnection -State Listen -LocalPort 3300 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { Stop-Process -Id $p -Force }"
      ],
      { stdio: "ignore" }
    );
    console.log("Stopped existing Ops Console process on port 3300, if present.");
  } catch {
    // No listener or PowerShell networking cmdlets unavailable; continue.
  }
}

export async function waitForHttp(url: string, label = url, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return response;
    } catch {
      // Retry below.
    }
    await delay(2000);
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

export async function repairKeycloakRealm() {
  const token = await keycloakAdminToken();
  await ensureClient(token, adminClient("talentos-admin", 3200));
  await ensureClient(token, portalClient("talentos-applicant", 3100));
  await ensureClient(token, opsClient("talentos-ops", "TalentOS Local Operations Console", "talentos-ops-secret"));
  await ensureClient(token, opsClient("talentos-ops-mfa", "TalentOS Local Operations Console MFA", "talentos-ops-mfa-secret"));
  const provisionerId = await ensureClient(token, {
    clientId: "talentos-provisioner",
    name: "TalentOS Admin Provisioner (service account)",
    description: "Confidential service-account client used by the admin app to create org-admin users and grant realm roles via the Keycloak Admin REST API.",
    enabled: true,
    protocol: "openid-connect",
    publicClient: false,
    secret: "talentos-provisioner-secret",
    standardFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: true,
    defaultClientScopes: ["roles"]
  });
  await assignProvisionerRoles(token, provisionerId);
  await ensureDemoUser(token, "accepted@demo.talentos.local", "Demo", "Accepted Applicant", "APPLICANT");
}

async function keycloakAdminToken() {
  const response = await fetch(`${local.keycloakBaseUrl}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: process.env.KC_ADMIN || "admin",
      password: process.env.KC_ADMIN_PASSWORD || "admin"
    })
  });
  if (!response.ok) throw new Error(`Keycloak admin token failed: ${response.status} ${await response.text()}`);
  return (await response.json() as { access_token: string }).access_token;
}

async function ensureClient(token: string, representation: Record<string, unknown>) {
  const clientId = String(representation.clientId);
  const existing = await keycloakGet<Array<{ id: string }>>(token, `/clients?clientId=${encodeURIComponent(clientId)}`);
  if (existing.length) {
    await keycloakPut(token, `/clients/${existing[0].id}`, representation);
    console.log(`Updated Keycloak client ${clientId}`);
    return existing[0].id;
  }
  await keycloakPost(token, "/clients", representation);
  const created = await keycloakGet<Array<{ id: string }>>(token, `/clients?clientId=${encodeURIComponent(clientId)}`);
  console.log(`Created Keycloak client ${clientId}`);
  return created[0].id;
}

function portalClient(clientId: string, port: number) {
  return {
    clientId,
    enabled: true,
    protocol: "openid-connect",
    publicClient: false,
    secret: `${clientId}-secret`,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    redirectUris: [
      `http://localhost:${port}/api/auth/callback/keycloak`,
      `http://localhost:${port}/*`,
      `http://lvh.me:${port}/api/auth/callback/keycloak`,
      `http://lvh.me:${port}/*`,
      `http://*.lvh.me:${port}/*`
    ],
    webOrigins: [`http://localhost:${port}`, `http://lvh.me:${port}`, `http://*.lvh.me:${port}`],
    attributes: {
      "post.logout.redirect.uris": `http://localhost:${port}/*##http://lvh.me:${port}/*##http://*.lvh.me:${port}/*`
    },
    defaultClientScopes: ["web-origins", "profile", "roles", "email"]
  };
}

function adminClient(clientId: string, port: number) {
  return { ...portalClient(clientId, port), name: "TalentOS Admin Portal" };
}

function opsClient(clientId: string, name: string, secret: string) {
  return {
    clientId,
    name,
    enabled: true,
    protocol: "openid-connect",
    publicClient: false,
    secret,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: false,
    redirectUris: [`${local.opsUrl}/auth/callback`, "http://localhost:3300/auth/callback"],
    webOrigins: [local.opsUrl, "http://localhost:3300"],
    attributes: {
      "post.logout.redirect.uris": `${local.opsUrl}/*##http://localhost:3300/*`
    },
    defaultClientScopes: ["web-origins", "profile", "roles", "email"]
  };
}

async function assignProvisionerRoles(token: string, provisionerId: string) {
  const serviceUser = await keycloakGet<{ id: string }>(token, `/clients/${provisionerId}/service-account-user`);
  const realmManagement = await keycloakGet<Array<{ id: string }>>(token, "/clients?clientId=realm-management");
  const roles = await keycloakGet<Array<{ id: string; name: string }>>(token, `/clients/${realmManagement[0].id}/roles`);
  const selected = roles.filter((role) => ["manage-users", "view-realm", "query-users"].includes(role.name));
  await keycloakPost(token, `/users/${serviceUser.id}/role-mappings/clients/${realmManagement[0].id}`, selected, [204, 409]);
}

async function ensureDemoUser(token: string, username: string, firstName: string, lastName: string, role: string) {
  const users = await keycloakGet<Array<{ id: string }>>(token, `/users?username=${encodeURIComponent(username)}&exact=true`);
  let userId = users[0]?.id;
  const representation = {
    username,
    email: username,
    firstName,
    lastName,
    enabled: true,
    emailVerified: true,
    credentials: [{ type: "password", value: "ChangeMe123!", temporary: false }]
  };
  if (!userId) {
    await keycloakPost(token, "/users", representation, [201]);
    userId = (await keycloakGet<Array<{ id: string }>>(token, `/users?username=${encodeURIComponent(username)}&exact=true`))[0].id;
  }
  const roles = await keycloakGet<Array<{ id: string; name: string }>>(token, "/roles");
  const selected = roles.filter((candidate) => candidate.name === role);
  await keycloakPost(token, `/users/${userId}/role-mappings/realm`, selected, [204, 409]);
}

async function keycloakGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${local.keycloakBaseUrl}/admin/realms/${local.keycloakRealm}${path}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Keycloak GET ${path} failed: ${response.status} ${await response.text()}`);
  return await response.json() as T;
}

async function keycloakPost(token: string, path: string, body: unknown, okStatuses = [201, 204]) {
  const response = await fetch(`${local.keycloakBaseUrl}/admin/realms/${local.keycloakRealm}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!okStatuses.includes(response.status)) {
    throw new Error(`Keycloak POST ${path} failed: ${response.status} ${await response.text()}`);
  }
}

async function keycloakPut(token: string, path: string, body: unknown) {
  const response = await fetch(`${local.keycloakBaseUrl}/admin/realms/${local.keycloakRealm}${path}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Keycloak PUT ${path} failed: ${response.status} ${await response.text()}`);
}

export async function startOpsConsoleIfNeeded() {
  try {
    await fetch(local.opsUrl, { redirect: "manual" });
    console.log("Ops Console is already running.");
    return;
  } catch {
    // Start it below.
  }
  const executable = commandForPlatform(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "ops:start"]);
  const child = spawn(executable.command, executable.args, {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, KEYCLOAK_ISSUER: keycloakIssuer }
  });
  child.unref();
}

function commandForPlatform(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteForCmd).join(" ")]
  };
}

function quoteForCmd(value: string) {
  return /^[A-Za-z0-9_.:/\\-]+$/.test(value) ? value : `"${value.replaceAll("\"", "\\\"")}"`;
}

function randomSecret() {
  return createHash("sha256").update(randomBytes(32)).digest("hex");
}
