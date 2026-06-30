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
});
