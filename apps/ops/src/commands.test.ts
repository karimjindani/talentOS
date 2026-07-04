import { describe, expect, it } from "vitest";
import { getCommandsForJob, isAllowedCommand, REGRESSION_AREAS } from "./commands";

describe("ops command allowlist", () => {
  it("allows only predefined commands", () => {
    for (const kind of ["regression", "cleanup", "reset"] as const) {
      for (const command of getCommandsForJob(kind)) {
        expect(isAllowedCommand(command.command, command.args)).toBe(true);
      }
    }
    expect(isAllowedCommand("powershell", ["Remove-Item", "-Recurse", "C:\\"])).toBe(false);
    expect(isAllowedCommand("docker", ["system", "prune", "-a"])).toBe(false);
  });

  it("allows every regression area command", () => {
    for (const area of REGRESSION_AREAS) {
      const [command] = getCommandsForJob("regression", area);
      expect(command.args).toEqual(["run", `regression:${area}`]);
      expect(isAllowedCommand(command.command, command.args)).toBe(true);
    }
  });
});
