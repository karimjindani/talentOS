import { describe, expect, it } from "vitest";
import {
  AREA_CODE,
  KNOWN_GAPS,
  PLATFORM,
  PROCESSES,
  SCOPE,
  SCOPES,
  assertScenarioCatalog,
  isProcess,
  isScope,
  type ScenarioCatalogEntry
} from "./evidence-taxonomy";
import { PROCESSES as FIXTURE_PROCESSES } from "../../tests/journeys/fixtures/types";

const valid: ScenarioCatalogEntry[] = [
  { id: "TOS-MIS-01", area: "missions", scopes: [SCOPE.MAJ] },
  { id: "TOS-MIS-02", area: "missions", scopes: [SCOPE.SMA] },
  { id: "TOS-PUB-01", area: "public-portal", scopes: [SCOPE.FMP, SCOPE.RJ] }
];

describe("the shared taxonomy", () => {
  it("is the one list the journey fixture uses, not a second copy of it", () => {
    // Reference equality — a re-copied array would pass a deep-equality check and then drift.
    expect(FIXTURE_PROCESSES).toBe(PROCESSES);
  });

  it("treats Platform as a scope but never as a business process", () => {
    expect(isScope(PLATFORM)).toBe(true);
    expect(isProcess(PLATFORM)).toBe(false);
    expect(SCOPES).toHaveLength(PROCESSES.length + 1);
  });

  it("gives every scope a short alias and every scope a known-gaps entry", () => {
    expect(Object.values(SCOPE).sort()).toEqual([...SCOPES].sort());
    for (const scope of SCOPES) expect(KNOWN_GAPS[scope]).toBeDefined();
  });

  it("codes every regression area the runner can report", () => {
    for (const area of [
      "unit",
      "auth",
      "ops",
      "applicant",
      "admin",
      "programs",
      "missions",
      "journal",
      "tenant",
      "dashboard",
      "storage",
      "public-portal"
    ]) {
      expect(AREA_CODE[area]).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("assertScenarioCatalog", () => {
  it("accepts a well-formed catalog", () => {
    expect(() => assertScenarioCatalog(valid)).not.toThrow();
  });

  it("rejects a duplicate TC ID and names both positions", () => {
    const entries = [...valid, { id: "TOS-MIS-01", area: "missions", scopes: [SCOPE.SMA] }];
    expect(() => assertScenarioCatalog(entries)).toThrow(/reuses TC ID TOS-MIS-01.*scenario #1/s);
  });

  it("rejects a missing TC ID", () => {
    expect(() => assertScenarioCatalog([{ id: "", area: "missions", scopes: [SCOPE.MAJ] }])).toThrow(
      /has no TC ID/
    );
  });

  it("rejects a TC ID whose code does not match the scenario's area", () => {
    expect(() => assertScenarioCatalog([{ id: "TOS-PUB-01", area: "missions", scopes: [SCOPE.MAJ] }])).toThrow(
      /must start with "TOS-MIS-"/
    );
  });

  it("rejects a malformed TC ID", () => {
    expect(() => assertScenarioCatalog([{ id: "MIS-1", area: "missions", scopes: [SCOPE.MAJ] }])).toThrow(
      /malformed TC ID/
    );
  });

  it("rejects a scenario that names no scope", () => {
    expect(() => assertScenarioCatalog([{ id: "TOS-MIS-01", area: "missions", scopes: [] }])).toThrow(
      /declares no scopes/
    );
  });

  it("rejects an unknown scope", () => {
    const entries = [{ id: "TOS-MIS-01", area: "missions", scopes: ["Nope"] as never }];
    expect(() => assertScenarioCatalog(entries)).toThrow(/unknown scope "Nope"/);
  });

  it("rejects an area with no TC ID code", () => {
    expect(() => assertScenarioCatalog([{ id: "TOS-XXX-01", area: "invented", scopes: [SCOPE.MAJ] }])).toThrow(
      /has no TC ID code in AREA_CODE/
    );
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const entries = [
      { id: "", area: "missions", scopes: [] },
      { id: "TOS-PUB-01", area: "missions", scopes: [SCOPE.MAJ] }
    ];
    try {
      assertScenarioCatalog(entries);
      throw new Error("expected assertScenarioCatalog to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("has no TC ID");
      expect(message).toContain("declares no scopes");
      expect(message).toContain('must start with "TOS-MIS-"');
    }
  });
});
