export type OperationHealthState = "healthy" | "degraded" | "unhealthy";

export type OperationHealthCheck = {
  name: string;
  status: OperationHealthState;
  detail: string;
};

export const LOCAL_REGRESSION_COMMANDS = {
  runTests: "npm.cmd run test",
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
