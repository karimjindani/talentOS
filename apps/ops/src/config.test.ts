import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { resolveRepoRoot } from "./config";

describe("ops config", () => {
  it("uses OPS_REPO_ROOT when provided", () => {
    const root = resolve("/mock-repo-root");
    expect(resolveRepoRoot({ OPS_REPO_ROOT: root })).toBe(root);
  });

  it("falls back to the repository root relative to the app directory", () => {
    const appDir = resolve("/mock-repo-root/apps/ops/src");
    expect(resolveRepoRoot({}, appDir)).toBe(resolve("/mock-repo-root"));
  });
});
