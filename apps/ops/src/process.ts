import { spawn } from "node:child_process";
import { REPO_ROOT } from "./config";

export type CommandResult = {
  exitCode: number | null;
  output: string;
  durationMs: number;
  timedOut: boolean;
};

export function runCommand(command: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolveCommand) => {
    const startedAt = Date.now();
    let output = "";
    let settled = false;

    let child;
    try {
      child = spawn(command, args, {
        cwd: REPO_ROOT,
        env: process.env,
        shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
        windowsHide: true
      });
    } catch (error) {
      resolveCommand({
        exitCode: null,
        output: error instanceof Error ? `${error.message}\n` : "Unable to start command.\n",
        durationMs: Date.now() - startedAt,
        timedOut: false
      });
      return;
    }

    const timeout = setTimeout(() => {
      if (settled) return;
      output += `\nCommand timed out after ${timeoutMs}ms.\n`;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", (error) => {
      output += `${error.message}\n`;
    });

    child.on("close", (exitCode) => {
      settled = true;
      clearTimeout(timeout);
      resolveCommand({
        exitCode,
        output,
        durationMs: Date.now() - startedAt,
        timedOut: output.includes("Command timed out")
      });
    });
  });
}

export async function captureCommand(command: string, args: string[], timeoutMs: number) {
  return runCommand(command, args, timeoutMs);
}
