import { describe, expect, it } from "vitest";
import { captureCommand, runCommand } from "./process";

describe("ops process command runner", () => {
  it("returns clean stdout without any debug prefix", async () => {
    // "node -e" prints exactly the given string to stdout — no "Working directory:" prefix.
    // This is the regression test for the bug where runCommand prepended
    // "Working directory: ..." which broke JSON.parse in the health checker.
    const result = await captureCommand("node", ["-e", "process.stdout.write('hello')"], 5000);
    expect(result.output.trim()).toBe("hello");
    expect(result.output).not.toContain("Working directory");
  });

  it("captures stdout and stderr together", async () => {
    const result = await captureCommand(
      "node",
      ["-e", "process.stdout.write('out'); process.stderr.write('err')"],
      5000
    );
    expect(result.output).toContain("out");
    expect(result.output).toContain("err");
  });

  it("reports exit code zero on success", async () => {
    const result = await captureCommand("node", ["-e", "process.exit(0)"], 5000);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it("reports non-zero exit code on failure", async () => {
    const result = await captureCommand("node", ["-e", "process.exit(1)"], 5000);
    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it("marks timed-out commands", async () => {
    // Sleep 10s but timeout after 200ms.
    const result = await runCommand("node", ["-e", "setTimeout(() => {}, 10000)"], 200);
    expect(result.timedOut).toBe(true);
  });

  it("returns valid JSON when the command prints JSON", async () => {
    // Critical regression test: the output must be parseable JSON with no prefix.
    // The old bug prepended "Working directory: ..." causing JSON.parse to fail
    // with "Unexpected token 'W', "Working di"... is not valid JSON".
    const json = JSON.stringify({ State: { Status: "running", Health: { Status: "healthy" } } });
    const result = await captureCommand(
      "node",
      ["-e", `process.stdout.write(${JSON.stringify(json)})`],
      5000
    );
    const parsed = JSON.parse(result.output);
    expect(parsed.State.Status).toBe("running");
    expect(parsed.State.Health.Status).toBe("healthy");
  });
});
