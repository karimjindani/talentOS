import { describe, expect, it } from "vitest";
import { extractBearerToken, isAuthorized } from "./security";

describe("ops token auth", () => {
  it("extracts bearer tokens", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("accepts only the configured token", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
    expect(isAuthorized("Bearer wrong", "secret")).toBe(false);
    expect(isAuthorized(undefined, "secret")).toBe(false);
    expect(isAuthorized("Bearer secret", "")).toBe(false);
  });
});
