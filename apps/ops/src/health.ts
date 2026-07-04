import type { OpsComponentCheck, OpsHealthResponse, OperationHealthState } from "@talentos/auth";
import { summarizeHealth } from "@talentos/auth";
import { loadDotEnv } from "./config";
import { captureCommand } from "./process";

const REQUEST_TIMEOUT_MS = 5000;
const CONTAINERS = [
  "talentos-admin",
  "talentos-applicant",
  "talentos-postgres",
  "talentos-keycloak",
  "talentos-keycloak-postgres",
  "talentos-minio",
  "talentos-minio-setup"
] as const;

export async function runHealthChecks(): Promise<OpsHealthResponse> {
  loadDotEnv();
  const checks: OpsComponentCheck[] = [
    await checkDockerDaemon(),
    ...(await Promise.all(CONTAINERS.map((name) => checkContainer(name)))),
    await checkDatabase(),
    await checkHttp("Keycloak realm", discoveryUrl()),
    await checkHttp("MinIO API", `${process.env.S3_ENDPOINT ?? "http://minio.lvh.me:9000"}/minio/health/live`),
    await checkHttp("Applicant Portal", process.env.NEXTAUTH_URL ?? "http://localhost:3100"),
    await checkHttp("Admin Portal", process.env.ADMIN_NEXTAUTH_URL ?? "http://localhost:3200")
  ];

  return {
    status: summarizeHealth(checks),
    checkedAt: new Date().toISOString(),
    checks
  };
}

export async function checkDockerDaemon(): Promise<OpsComponentCheck> {
  const startedAt = Date.now();
  const result = await captureCommand("docker", ["version"], REQUEST_TIMEOUT_MS);
  if (result.exitCode === 0) {
    return {
      name: "Docker daemon",
      status: "healthy",
      detail: "Docker client and server responded.",
      durationMs: Date.now() - startedAt,
      source: "host"
    };
  }
  return {
    name: "Docker daemon",
    status: "unhealthy",
    detail: trimDetail(result.output) || "Docker did not respond.",
    durationMs: Date.now() - startedAt,
    source: "host"
  };
}

export async function checkContainer(name: string): Promise<OpsComponentCheck> {
  const startedAt = Date.now();
  const result = await captureCommand("docker", ["inspect", name], REQUEST_TIMEOUT_MS);
  if (result.exitCode !== 0) {
    return {
      name,
      status: "unhealthy",
      detail: trimDetail(result.output) || "Container was not found.",
      durationMs: Date.now() - startedAt,
      source: "docker"
    };
  }

  try {
    const [container] = JSON.parse(result.output) as Array<{ State?: DockerState }>;
    return dockerStateToCheck(name, container?.State, Date.now() - startedAt);
  } catch (error) {
    return {
      name,
      status: "unhealthy",
      detail: error instanceof Error ? error.message : "Unable to parse docker inspect output.",
      durationMs: Date.now() - startedAt,
      source: "docker"
    };
  }
}

export function dockerStateToCheck(name: string, state: DockerState | undefined, durationMs = 0): OpsComponentCheck {
  if (!state) {
    return { name, status: "unhealthy", detail: "Container state is missing.", durationMs, source: "docker" };
  }
  const health = state.Health?.Status;
  const status = dockerHealthToStatus(state.Status, health, state.ExitCode);
  const detailParts = [`status=${state.Status}`];
  if (health) detailParts.push(`health=${health}`);
  if (typeof state.ExitCode === "number" && state.Status === "exited") detailParts.push(`exitCode=${state.ExitCode}`);
  const detail = detailParts.join("; ");
  return { name, status, detail, durationMs, source: "docker" };
}

export function dockerHealthToStatus(
  status: string | undefined,
  health?: string,
  exitCode?: number
): OperationHealthState {
  if (status !== "running" && status !== "exited") return "unhealthy";
  if (status === "exited") return exitCode === 0 ? "healthy" : "degraded";
  if (!health) return "healthy";
  if (health === "healthy") return "healthy";
  if (health === "starting") return "degraded";
  return "unhealthy";
}

async function checkDatabase(): Promise<OpsComponentCheck> {
  const startedAt = Date.now();
  try {
    const { prisma } = await import("@talentos/db");
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: "PostgreSQL query",
      status: "healthy",
      detail: "Database query succeeded.",
      durationMs: Date.now() - startedAt,
      source: "database"
    };
  } catch (error) {
    return {
      name: "PostgreSQL query",
      status: "unhealthy",
      detail: errorDetail(error),
      durationMs: Date.now() - startedAt,
      source: "database"
    };
  }
}

async function checkHttp(name: string, url: string): Promise<OpsComponentCheck> {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal });
    clearTimeout(timeout);
    const healthy = response.ok || response.status === 307 || response.status === 308;
    return {
      name,
      status: healthy ? "healthy" : "unhealthy",
      detail: `${url} returned HTTP ${response.status}.`,
      durationMs: Date.now() - startedAt,
      source: "http"
    };
  } catch (error) {
    return {
      name,
      status: "unhealthy",
      detail: `${url}: ${errorDetail(error)}`,
      durationMs: Date.now() - startedAt,
      source: "http"
    };
  }
}

function discoveryUrl(): string {
  const issuer = process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos";
  return `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
}

function trimDetail(value: string) {
  return value.trim().split(/\r?\n/).slice(0, 5).join(" | ");
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

type DockerState = {
  Status?: string;
  ExitCode?: number;
  Health?: {
    Status?: string;
  };
};
