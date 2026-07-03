import { describe, expect, it } from "vitest";
import { dockerHealthToStatus, dockerStateToCheck } from "./health";

describe("ops health parsing", () => {
  it("maps docker health states", () => {
    expect(dockerHealthToStatus("running", "healthy")).toBe("healthy");
    expect(dockerHealthToStatus("running", "starting")).toBe("degraded");
    expect(dockerHealthToStatus("running", "unhealthy")).toBe("unhealthy");
    expect(dockerHealthToStatus("exited", undefined, 0)).toBe("healthy");
    expect(dockerHealthToStatus("exited", undefined, 1)).toBe("degraded");
    expect(dockerHealthToStatus("created")).toBe("unhealthy");
  });

  it("creates component checks from docker inspect state", () => {
    expect(dockerStateToCheck("talentos-postgres", { Status: "running", Health: { Status: "healthy" } })).toMatchObject({
      name: "talentos-postgres",
      status: "healthy"
    });
    expect(dockerStateToCheck("talentos-admin", { Status: "exited", ExitCode: 1 })).toMatchObject({
      status: "degraded"
    });
    expect(dockerStateToCheck("missing", undefined)).toMatchObject({
      status: "unhealthy"
    });
  });

  it("handles containers with no Health field (no docker healthcheck)", () => {
    // Containers like talentos-admin and talentos-keycloak have no Docker healthcheck,
    // so .State.Health is undefined. They should still be healthy if running.
    const check = dockerStateToCheck("talentos-admin", { Status: "running", ExitCode: 0 }, 100);
    expect(check.status).toBe("healthy");
    expect(check.detail).toBe("status=running");
  });

  it("handles exited setup containers as healthy with exit code 0", () => {
    // minio-setup exits 0 after creating the bucket — should be healthy, not unhealthy.
    const check = dockerStateToCheck("talentos-minio-setup", { Status: "exited", ExitCode: 0 }, 100);
    expect(check.status).toBe("healthy");
    expect(check.detail).toContain("exitCode=0");
  });

  it("parses docker inspect JSON array structure correctly", () => {
    // Simulates the exact structure returned by `docker inspect <container>`:
    // a JSON array with one element containing .State with Status, ExitCode, Health.
    // The old bug in process.ts prepended "Working directory:" which broke JSON.parse,
    // causing all container checks to show "Unexpected token 'W'" unhealthy.
    const dockerInspectOutput = [
      { State: { Status: "running", ExitCode: 0, Health: { Status: "healthy" } } }
    ];
    const [container] = dockerInspectOutput;
    const check = dockerStateToCheck("talentos-postgres", container.State, 100);
    expect(check.status).toBe("healthy");
    expect(check.detail).toContain("status=running");
    expect(check.detail).toContain("health=healthy");
  });
});
