import { describe, expect, it } from "vitest";
import { resolveRepoRoot } from "./config";

describe("ops config", () => {
  it("uses OPS_REPO_ROOT when provided", () => {
    expect(resolveRepoRoot({ OPS_REPO_ROOT: "D:\\Hitesh\\Virtual Intern Platform" })).toBe(
      "D:\\Hitesh\\Virtual Intern Platform"
    );
  });

  it("falls back to the repository root relative to the app directory", () => {
    expect(resolveRepoRoot({}, "D:\\Hitesh\\Virtual Intern Platform\\apps\\ops\\src")).toBe(
      "D:\\Hitesh\\Virtual Intern Platform"
    );
  });
});
