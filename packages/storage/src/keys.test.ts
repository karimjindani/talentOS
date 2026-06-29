import { describe, expect, it } from "vitest";
import { buildObjectKey, sanitizeFilename } from "./keys";

describe("sanitizeFilename", () => {
  it("lowercases and replaces unsafe characters with hyphens", () => {
    expect(sanitizeFilename("My CV (2026).PDF")).toBe("my-cv-2026-.pdf");
  });

  it("keeps dots, dashes and underscores", () => {
    expect(sanitizeFilename("resume_v1.2-final.pdf")).toBe("resume_v1.2-final.pdf");
  });

  it("falls back to 'file' when nothing usable remains", () => {
    expect(sanitizeFilename("***")).toBe("file");
  });
});

describe("buildObjectKey", () => {
  it("namespaces by tenant and category with a uuid and safe filename", () => {
    const key = buildObjectKey({ tenantId: "t1", category: "cv", filename: "Resume.pdf" });
    expect(key).toMatch(/^tenant\/t1\/cv\/[0-9a-f-]{36}-resume\.pdf$/);
  });

  it("isolates different tenants under different prefixes", () => {
    expect(buildObjectKey({ tenantId: "a", category: "cv", filename: "x.pdf" }).startsWith("tenant/a/cv/")).toBe(true);
    expect(buildObjectKey({ tenantId: "b", category: "cv", filename: "x.pdf" }).startsWith("tenant/b/cv/")).toBe(true);
  });
});
