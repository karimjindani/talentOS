import type { OpsJobKind } from "@talentos/auth";

export type CommandSpec = {
  id: string;
  name: string;
  command: string;
  args: string[];
  timeoutMs: number;
};

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

export const OPS_JOB_COMMANDS: Record<OpsJobKind, CommandSpec[]> = {
  regression: [
    {
      id: "test",
      name: "Run regression tests",
      command: npmBin,
      args: ["run", "test"],
      timeoutMs: 5 * 60 * 1000
    }
  ],
  cleanup: [
    {
      id: "cleanup-regression",
      name: "Cleanup regression testing generated data",
      command: npmBin,
      args: ["run", "ops:cleanup-regression"],
      timeoutMs: 2 * 60 * 1000
    }
  ],
  reset: [
    {
      id: "compose-down",
      name: "Stop and remove TalentOS Compose resources",
      command: "docker",
      args: ["compose", "down", "-v", "--remove-orphans"],
      timeoutMs: 5 * 60 * 1000
    },
    {
      id: "db-generate",
      name: "Generate Prisma client",
      command: npmBin,
      args: ["run", "db:generate"],
      timeoutMs: 2 * 60 * 1000
    },
    {
      id: "compose-up",
      name: "Rebuild and start local stack",
      command: "docker",
      args: ["compose", "up", "-d", "--build"],
      timeoutMs: 20 * 60 * 1000
    },
    {
      id: "db-migrate",
      name: "Run database migrations",
      command: npmBin,
      args: ["run", "db:migrate"],
      timeoutMs: 5 * 60 * 1000
    },
    {
      id: "db-seed",
      name: "Seed demo data",
      command: npmBin,
      args: ["run", "db:seed"],
      timeoutMs: 2 * 60 * 1000
    },
    {
      id: "compose-ps",
      name: "Show Compose status",
      command: "docker",
      args: ["compose", "ps"],
      timeoutMs: 60 * 1000
    }
  ]
};

const allowedCommands = Object.values(OPS_JOB_COMMANDS)
  .flat()
  .map((spec) => commandKey(spec.command, spec.args));

export function formatCommand(spec: Pick<CommandSpec, "command" | "args">): string {
  return [spec.command, ...spec.args].join(" ");
}

export function isAllowedCommand(command: string, args: string[]): boolean {
  return allowedCommands.includes(commandKey(command, args));
}

export function getCommandsForJob(kind: OpsJobKind): CommandSpec[] {
  return OPS_JOB_COMMANDS[kind];
}

function commandKey(command: string, args: string[]) {
  return JSON.stringify([command, ...args]);
}
