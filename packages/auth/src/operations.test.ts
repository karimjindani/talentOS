import { describe, expect, it } from "vitest";
import {
  LOCAL_RESET_COMMANDS,
  LOCAL_REGRESSION_COMMANDS,
  resetCommandsTargetTalentOSOnly,
  summarizeHealth
} from "./operations";

describe("operations helpers", () => {
  it("summarizes health checks by worst status", () => {
    expect(summarizeHealth([{ name: "db", status: "healthy", detail: "ok" }])).toBe("healthy");
    expect(
      summarizeHealth([
        { name: "db", status: "healthy", detail: "ok" },
        { name: "minio", status: "degraded", detail: "slow" }
      ])
    ).toBe("degraded");
    expect(
      summarizeHealth([
        { name: "db", status: "degraded", detail: "slow" },
        { name: "keycloak", status: "unhealthy", detail: "down" }
      ])
    ).toBe("unhealthy");
  });

  it("exposes local regression commands without running them", () => {
    expect(LOCAL_REGRESSION_COMMANDS.runTests).toBe("npm.cmd run test");
    expect(LOCAL_REGRESSION_COMMANDS.cleanupRegressionData).toBe("npm.cmd run ops:cleanup-regression");
  });

  it("keeps reset commands scoped to the TalentOS Compose project", () => {
    expect(resetCommandsTargetTalentOSOnly()).toBe(true);
    expect(LOCAL_RESET_COMMANDS.join(" ")).not.toContain("openpay");
  });
});
