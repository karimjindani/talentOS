import { describe, expect, it } from "vitest";
import { getCommandsForJob, isAllowedCommand } from "./commands";

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
});
