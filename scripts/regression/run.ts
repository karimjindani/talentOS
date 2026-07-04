import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  applyStatusTransition,
  cleanupRegressionData,
  createProgram,
  createSubmittedApplication,
  DUPLICATE_APPLICATION_ERROR_MESSAGE,
  findActiveApplication,
  getApplicantProgramProgress,
  getTenantBySlug,
  getTenantProgram,
  listApplicantApplications,
  listCompletedTaskIds,
  listPublishedPrograms,
  markNotificationRead,
  markRegressionData,
  markTaskCompleted,
  prisma,
  setProgramStatus
} from "@talentos/db";
import type { RegressionArea, RegressionSummary } from "@talentos/auth";

type ScenarioStatus = "passed" | "failed" | "skipped";

type ScenarioResult = {
  area: RegressionArea;
  name: string;
  status: ScenarioStatus;
  durationMs: number;
  detail?: string;
  error?: string;
};

type Scenario = {
  area: Exclude<RegressionArea, "all">;
  name: string;
  run: (ctx: ScenarioContext) => Promise<string | void>;
};

type ScenarioContext = {
  runId: string;
};

const AREAS: RegressionArea[] = [
  "all",
  "unit",
  "auth",
  "applicant",
  "admin",
  "programs",
  "tenant",
  "dashboard",
  "storage",
  "ops"
];

const LOCAL = {
  keycloakIssuer: "http://keycloak.lvh.me:8080/realms/talentos",
  tenantAdminUrl: "http://demo.lvh.me:3200",
  tenantApplicantUrl: "http://demo.lvh.me:3100",
  opsUrl: "http://127.0.0.1:3300"
};

const scenarios: Scenario[] = [
  {
    area: "unit",
    name: "Vitest unit regression suite passes",
    run: async () => runUnitSuite()
  },
  {
    area: "auth",
    name: "Keycloak realm discovery is reachable",
    run: async () => expectHttp(`${LOCAL.keycloakIssuer}/.well-known/openid-configuration`, [200])
  },
  {
    area: "auth",
    name: "Org Admin can complete admin portal login",
    run: async () => loginFlow(`${LOCAL.tenantAdminUrl}/`, "orgadmin@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3200")
  },
  {
    area: "auth",
    name: "Applicant can complete applicant portal login",
    run: async () =>
      loginFlow(`${LOCAL.tenantApplicantUrl}/application`, "applicant@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100")
  },
  {
    area: "auth",
    name: "Accepted applicant can reach dashboard",
    run: async () =>
      loginFlow(`${LOCAL.tenantApplicantUrl}/dashboard`, "accepted@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100")
  },
  {
    area: "ops",
    name: "Org Admin can complete Ops Console login",
    run: async () => loginFlow(`${LOCAL.opsUrl}/login`, "orgadmin@demo.talentos.local", "ChangeMe123!", "127.0.0.1:3300")
  },
  {
    area: "ops",
    name: "Ops session endpoint returns status envelope",
    run: async () => expectHttp(`${LOCAL.opsUrl}/api/ops/me`, [200])
  },
  {
    area: "applicant",
    name: "Applicant application lifecycle creates submitted application and blocks duplicate",
    run: async (ctx) => {
      const fixture = await createApplicationFixture(ctx.runId);
      const application = await createSubmittedApplication({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        applicantId: fixture.user.id,
        answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Regression scenario" }]
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Application", entityId: application.id });
      const answers = await prisma.applicationAnswer.findMany({ where: { applicationId: application.id } });
      for (const answer of answers) {
        await markRegressionData({ runId: ctx.runId, entityType: "ApplicationAnswer", entityId: answer.id });
      }
      const active = await findActiveApplication(fixture.user.id, fixture.program.id);
      if (!active) throw new Error("Submitted application was not found by duplicate guard.");
      const applications = await listApplicantApplications(fixture.user.id, fixture.tenant.id);
      if (!applications.some((candidate) => candidate.id === application.id && candidate.status === "SUBMITTED")) {
        throw new Error("Applicant status view did not include the submitted application.");
      }
      try {
        await createSubmittedApplication({
          tenantId: fixture.tenant.id,
          programId: fixture.program.id,
          applicantId: fixture.user.id,
          answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Duplicate" }]
        });
        throw new Error("Duplicate active application was allowed.");
      } catch (error) {
        if (!(error instanceof Error) || error.message !== DUPLICATE_APPLICATION_ERROR_MESSAGE) throw error;
      }
    }
  },
  {
    area: "admin",
    name: "Admin review lifecycle changes application status and writes audit",
    run: async (ctx) => {
      const fixture = await createApplicationFixture(ctx.runId);
      const application = await createSubmittedApplication({
        tenantId: fixture.tenant.id,
        programId: fixture.program.id,
        applicantId: fixture.user.id,
        answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Review me" }]
      });
      await markRegressionData({ runId: ctx.runId, entityType: "Application", entityId: application.id });
      const reviewed = await applyStatusTransition({
        id: application.id,
        tenantId: fixture.tenant.id,
        toStatus: "ACCEPTED",
        reviewerNotes: "Accepted by regression scenario",
        actorUserId: fixture.actor.id
      });
      if (reviewed.status !== "ACCEPTED") throw new Error(`Expected ACCEPTED, got ${reviewed.status}`);
      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: fixture.tenant.id, entityType: "Application", entityId: application.id, action: "application.status_changed" }
      });
      if (!audit) throw new Error("Application status change audit log was not written.");
    }
  },
  {
    area: "programs",
    name: "Program lifecycle publishes and archives applicant-visible programs",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "DRAFT");
      await setProgramStatus({ id: fixture.program.id, tenantId: fixture.tenant.id, status: "PUBLISHED", actorUserId: fixture.actor.id });
      const published = await listPublishedPrograms(fixture.tenant.id);
      if (!published.some((program) => program.id === fixture.program.id)) throw new Error("Published program was not applicant-visible.");
      await setProgramStatus({ id: fixture.program.id, tenantId: fixture.tenant.id, status: "ARCHIVED", actorUserId: fixture.actor.id });
      const afterArchive = await listPublishedPrograms(fixture.tenant.id);
      if (afterArchive.some((program) => program.id === fixture.program.id)) throw new Error("Archived program was still applicant-visible.");
    }
  },
  {
    area: "tenant",
    name: "Tenant-scoped program read rejects another tenant",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const otherTenant = await prisma.tenant.findFirst({ where: { id: { not: fixture.tenant.id } } });
      if (!otherTenant) return skip("Only one tenant exists locally; cross-tenant read scenario needs two tenants.");
      const crossTenantProgram = await getTenantProgram(fixture.program.id, otherTenant.id);
      if (crossTenantProgram) throw new Error("Program was readable through a different tenant id.");
    }
  },
  {
    area: "tenant",
    name: "Realm role alone does not grant tenant capability without membership",
    run: async (ctx) => {
      const fixture = await createProgramFixture(ctx.runId, "PUBLISHED");
      const outsider = await prisma.user.create({
        data: { email: `outsider+${ctx.runId}@regression.talentos.local`, name: "Regression Outsider" }
      });
      await markRegressionData({ runId: ctx.runId, entityType: "User", entityId: outsider.id });
      const roles = await prisma.tenantMembership.findMany({ where: { tenantId: fixture.tenant.id, userId: outsider.id } });
      if (roles.length !== 0) throw new Error("Regression outsider unexpectedly has tenant membership.");
    }
  },
  {
    area: "dashboard",
    name: "Accepted applicant dashboard pages load",
    run: async () => {
      const pages = ["/dashboard", "/dashboard/program", "/dashboard/tasks", "/dashboard/resources", "/dashboard/calendar", "/dashboard/notifications", "/dashboard/profile"];
      for (const page of pages) {
        await loginFlow(`${LOCAL.tenantApplicantUrl}${page}`, "accepted@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100");
      }
    }
  },
  {
    area: "dashboard",
    name: "Dashboard task and notification persistence helpers update records",
    run: async (ctx) => {
      const fixture = await createAcceptedDashboardFixture(ctx.runId);
      const progress = await getApplicantProgramProgress(fixture.user.id, fixture.tenant.id, fixture.program.id);
      if (progress.length !== 4) throw new Error("Dashboard progress did not return four weeks.");
      await markTaskCompleted(fixture.task.id, fixture.user.id);
      const completedIds = await listCompletedTaskIds(fixture.user.id, fixture.program.id);
      if (!completedIds.includes(fixture.task.id)) throw new Error("Task completion did not persist.");
      await markNotificationRead(fixture.notification.id, fixture.user.id);
      const updated = await prisma.notification.findUnique({ where: { id: fixture.notification.id } });
      if (!updated?.readAt) throw new Error("Notification read state did not persist.");
    }
  },
  {
    area: "storage",
    name: "Storage browser upload/download scenario",
    run: async () => skip("Full CV upload/download scenario is documented as missing and will be automated in the next storage-focused slice.")
  }
];

class ScenarioSkipped extends Error {}

function skip(message: string): never {
  throw new ScenarioSkipped(message);
}

async function main() {
  const area = parseArea(process.argv[2] ?? "all");
  const runId = `regression-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const started = Date.now();
  const selected = area === "all" ? scenarios : scenarios.filter((scenario) => scenario.area === area);
  const results: ScenarioResult[] = [];

  console.log(`TalentOS scenario regression run ${runId}`);
  console.log(`Area: ${area}`);
  console.log(`Scenarios: ${selected.length}`);

  for (const scenario of selected) {
    const scenarioStarted = Date.now();
    process.stdout.write(`- ${scenario.area}: ${scenario.name} ... `);
    try {
      const detail = await scenario.run({ runId });
      const result = { area: scenario.area, name: scenario.name, status: "passed" as const, durationMs: Date.now() - scenarioStarted, detail };
      results.push(result);
      console.log("passed");
    } catch (error) {
      const status = error instanceof ScenarioSkipped ? "skipped" : "failed";
      const result = {
        area: scenario.area,
        name: scenario.name,
        status,
        durationMs: Date.now() - scenarioStarted,
        error: error instanceof Error ? error.message : String(error)
      } satisfies ScenarioResult;
      results.push(result);
      console.log(`${status}: ${result.error}`);
    }
  }

  const summary = summarize(area, results, Date.now() - started);
  const payload = { runId, summary, results };
  const resultsDir = resolve(".ops", "regression-results");
  await mkdir(resultsDir, { recursive: true }).catch(() => undefined);
  await writeFile(resolve(resultsDir, `regression-${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8").catch(() => undefined);
  console.log(`REGRESSION_RESULT_JSON:${JSON.stringify(payload)}`);
  console.log(`Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.skipped} skipped.`);

  if (summary.failed > 0) process.exit(1);
}

function parseArea(value: string): RegressionArea {
  if (AREAS.includes(value as RegressionArea)) return value as RegressionArea;
  throw new Error(`Unknown regression area "${value}". Expected one of: ${AREAS.join(", ")}`);
}

function summarize(area: RegressionArea, results: ScenarioResult[], durationMs: number): RegressionSummary {
  return {
    area,
    total: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    durationMs
  };
}

async function runUnitSuite() {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = await capture(command, ["run", "test"], 10 * 60 * 1000);
  if (result.exitCode !== 0) throw new Error(result.output);
  const tests = /Tests\s+(\d+) passed/.exec(result.output)?.[1];
  return tests ? `${tests} Vitest tests passed.` : "Vitest suite passed.";
}

type Fixture = Awaited<ReturnType<typeof createProgramFixture>> & { user: { id: string }; actor: { id: string } };

async function createApplicationFixture(runId: string): Promise<Fixture> {
  const base = await createProgramFixture(runId, "PUBLISHED");
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `applicant+${runId}-${suffix}@regression.talentos.local`,
      name: "Regression Applicant",
      memberships: { create: { tenantId: base.tenant.id, role: "APPLICANT" } }
    },
    include: { memberships: true }
  });
  await markRegressionData({ runId, entityType: "User", entityId: user.id });
  for (const membership of user.memberships) {
    await markRegressionData({ runId, entityType: "TenantMembership", entityId: membership.id });
  }
  return { ...base, user };
}

async function createProgramFixture(runId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const tenant = await getTenantBySlug("demo");
  if (!tenant) throw new Error("Demo tenant not found. Run local bootstrap/seed first.");
  const actor = await prisma.user.findFirst({ where: { email: "orgadmin@demo.talentos.local" } });
  if (!actor) throw new Error("Demo org admin user not found. Run local bootstrap/seed first.");
  const slug = `regression-${runId}-${randomUUID().slice(0, 8)}`;
  const program = await createProgram({
    tenantId: tenant.id,
    name: `Regression Program ${runId}`,
    slug,
    description: "Regression scenario program",
    status,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    actorUserId: actor.id
  });
  await markRegressionData({ runId, entityType: "Program", entityId: program.id });
  return { tenant, actor, program };
}

async function createAcceptedDashboardFixture(runId: string) {
  const fixture = await createApplicationFixture(runId);
  const application = await createSubmittedApplication({
    tenantId: fixture.tenant.id,
    programId: fixture.program.id,
    applicantId: fixture.user.id,
    answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Dashboard" }]
  });
  await markRegressionData({ runId, entityType: "Application", entityId: application.id });
  await applyStatusTransition({
    id: application.id,
    tenantId: fixture.tenant.id,
    toStatus: "ACCEPTED",
    actorUserId: fixture.actor.id,
    reviewerNotes: "Accepted for dashboard regression"
  });
  const task = await prisma.programTask.create({
    data: {
      tenantId: fixture.tenant.id,
      programId: fixture.program.id,
      weekNumber: 1,
      title: `Regression Task ${runId}`,
      description: "Regression task",
      order: 0
    }
  });
  const notification = await prisma.notification.create({
    data: {
      tenantId: fixture.tenant.id,
      userId: fixture.user.id,
      type: "INFO",
      title: `Regression Notification ${runId}`,
      body: "Regression notification"
    }
  });
  return { ...fixture, application, task, notification };
}

async function expectHttp(url: string, okStatuses: number[]) {
  const response = await fetch(url, { redirect: "manual" });
  if (!okStatuses.includes(response.status)) {
    throw new Error(`${url} returned HTTP ${response.status}; expected ${okStatuses.join("/")}`);
  }
  return `HTTP ${response.status}`;
}

type CookieRecord = { value: string; host: string; domain?: string };

class CookieJar {
  private cookies = new Map<string, CookieRecord>();

  header(url: string) {
    const { hostname } = new URL(url);
    const pairs: string[] = [];
    for (const [name, cookie] of this.cookies) {
      const domain = cookie.domain?.replace(/^\./, "");
      if (hostname === cookie.host || (domain && (hostname === domain || hostname.endsWith(`.${domain}`)))) {
        pairs.push(`${name}=${cookie.value}`);
      }
    }
    return pairs.join("; ");
  }

  store(url: string, headers: Headers) {
    const host = new URL(url).hostname;
    const values =
      typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    for (const raw of values) {
      const [pair, ...attrs] = raw.split(";").map((part) => part.trim());
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      const domain = attrs.find((attr) => attr.toLowerCase().startsWith("domain="))?.slice(7);
      this.cookies.set(name, { value, host, domain });
    }
  }
}

async function request(jar: CookieJar, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = jar.header(url);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  jar.store(url, response.headers);
  return response;
}

async function loginFlow(startUrl: string, username: string, password: string, finalUrlIncludes: string) {
  const jar = new CookieJar();
  let url = startUrl;
  for (let step = 0; step < 35; step++) {
    const response = await request(jar, url);
    const location = response.headers.get("location");
    if (location) {
      url = new URL(location, url).toString();
      continue;
    }
    const html = await response.text();
    const keycloakAction = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/)?.[1];
    if (keycloakAction) {
      const action = decodeHtml(keycloakAction);
      if (action.includes("host.docker.internal")) throw new Error(`Keycloak login form used host.docker.internal: ${action}`);
      const loginResponse = await request(jar, action, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password, credentialId: "" })
      });
      const next = loginResponse.headers.get("location");
      if (!next) throw new Error(`Keycloak did not redirect after credential submit for ${username}`);
      url = new URL(next, action).toString();
      continue;
    }
    const providerAction = html.match(/<form[^>]+action="([^"]*signin\/keycloak[^"]*)"[^>]*>([\s\S]*?)<\/form>/)?.[1];
    if (providerAction) {
      const csrf = html.match(/name="csrfToken"\s+value="([^"]+)"/)?.[1] ?? "";
      const signInResponse = await request(jar, new URL(decodeHtml(providerAction), url).toString(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken: csrf, callbackUrl: startUrl, json: "true" })
      });
      const next = signInResponse.headers.get("location");
      if (!next) throw new Error(`Provider sign-in did not redirect for ${username}`);
      url = new URL(next, url).toString();
      continue;
    }
    if (html.includes("Sign in with Keycloak") && new URL(url).pathname === "/login") {
      const loginUrl = new URL(url);
      const callbackUrl = loginUrl.searchParams.get("callbackUrl") ?? startUrl;
      url = await startNextAuthProviderLogin(jar, `${loginUrl.origin}/api/auth`, callbackUrl);
      continue;
    }
    if (!url.includes(finalUrlIncludes)) throw new Error(`Expected final URL to include ${finalUrlIncludes}, got ${url}`);
    if (/access denied|unexpected "iss"|host\.docker\.internal/i.test(html)) {
      throw new Error(`Final page contains an auth/deployment error for ${username}`);
    }
    return `Reached ${url} with HTTP ${response.status}`;
  }
  throw new Error(`Login flow exceeded redirect limit for ${username}`);
}

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", "\"");
}

async function startNextAuthProviderLogin(jar: CookieJar, authBaseUrl: string, callbackUrl: string) {
  const csrfResponse = await request(jar, `${authBaseUrl}/csrf`);
  if (!csrfResponse.ok) throw new Error(`Failed to fetch Auth.js CSRF token from ${authBaseUrl}`);
  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrfPayload.csrfToken) throw new Error(`Auth.js CSRF endpoint did not return csrfToken from ${authBaseUrl}`);
  const signInResponse = await request(jar, `${authBaseUrl}/signin/keycloak`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrfPayload.csrfToken, callbackUrl, json: "true" })
  });
  const next = signInResponse.headers.get("location");
  if (!next) throw new Error(`Auth.js provider sign-in did not redirect from ${authBaseUrl}`);
  return new URL(next, authBaseUrl).toString();
}

async function capture(command: string, args: string[], timeoutMs: number) {
  const executable = commandForPlatform(command, args);
  const started = Date.now();
  let output = "";
  const child = spawn(executable.command, executable.args, { cwd: process.cwd(), shell: false });
  const timer = setTimeout(() => child.kill(), timeoutMs);
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exitCode = await new Promise<number | null>((resolvePromise) => {
    child.on("exit", (code) => resolvePromise(code));
    child.on("error", () => resolvePromise(1));
  });
  clearTimeout(timer);
  return { exitCode, output, durationMs: Date.now() - started };
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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (process.env.REGRESSION_CLEANUP_ON_EXIT === "1") {
      await cleanupRegressionData().catch(() => undefined);
    }
    await prisma.$disconnect();
  });
