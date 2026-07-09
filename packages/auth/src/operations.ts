export type OperationHealthState = "healthy" | "degraded" | "unhealthy";

export type OperationHealthCheck = {
  name: string;
  status: OperationHealthState;
  detail: string;
};

export type OpsComponentCheck = OperationHealthCheck & {
  durationMs?: number;
  source?: "host" | "docker" | "http" | "database" | "browser";
};

export type OpsHealthResponse = {
  status: OperationHealthState;
  checkedAt: string;
  checks: OpsComponentCheck[];
};

export type OpsJobKind = "regression" | "cleanup" | "reset";

export type OpsJobStatus = "queued" | "running" | "passed" | "failed";

export type RegressionArea =
  | "all"
  | "unit"
  | "auth"
  | "applicant"
  | "admin"
  | "programs"
  | "missions"
  | "journal"
  | "tenant"
  | "dashboard"
  | "storage"
  | "ops";

export type RegressionSummary = {
  area: RegressionArea;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
};

export type OpsJobStep = {
  id: string;
  name: string;
  command: string;
  status: OpsJobStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  exitCode?: number | null;
  output: string;
  regressionSummary?: RegressionSummary;
  regressionSummaries?: RegressionSummary[];
};

export type OpsJob = {
  id: string;
  kind: OpsJobKind;
  area?: RegressionArea;
  status: OpsJobStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  steps: OpsJobStep[];
  output: string;
  error?: string;
  regressionSummary?: RegressionSummary;
  regressionSummaries?: RegressionSummary[];
};

export const LOCAL_REGRESSION_COMMANDS = {
  runTests: "npm.cmd run regression:all",
  runUnitTests: "npm.cmd run regression:unit",
  cleanupRegressionData: "npm.cmd run ops:cleanup-regression",
  cleanupRegressionRun: "npm.cmd run ops:cleanup-regression -- <runId>"
} as const;

export const LOCAL_RESET_COMMANDS = [
  "docker compose down -v --remove-orphans",
  "npm.cmd run db:generate",
  "docker compose up -d --build",
  "npm.cmd run db:migrate",
  "npm.cmd run db:seed",
  "docker compose ps"
] as const;

export function summarizeHealth(checks: readonly OperationHealthCheck[]): OperationHealthState {
  if (checks.some((check) => check.status === "unhealthy")) {
    return "unhealthy";
  }
  if (checks.some((check) => check.status === "degraded")) {
    return "degraded";
  }
  return "healthy";
}

export function resetCommandsTargetTalentOSOnly(commands = LOCAL_RESET_COMMANDS): boolean {
  return (
    commands.some((command) => command === "docker compose down -v --remove-orphans") &&
    commands.every((command) => !command.includes("openpay"))
  );
}
