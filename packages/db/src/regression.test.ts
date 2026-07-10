import { describe, expect, it } from "vitest";
import { REGRESSION_CLEANUP_ORDER } from "./regression";

describe("regression data cleanup", () => {
  it("deletes dependent regression data before parent records", () => {
    expect(REGRESSION_CLEANUP_ORDER.indexOf("ApplicationAnswer")).toBeLessThan(
      REGRESSION_CLEANUP_ORDER.indexOf("Application")
    );
    expect(REGRESSION_CLEANUP_ORDER.indexOf("Application")).toBeLessThan(REGRESSION_CLEANUP_ORDER.indexOf("User"));
    expect(REGRESSION_CLEANUP_ORDER.indexOf("TenantMembership")).toBeLessThan(
      REGRESSION_CLEANUP_ORDER.indexOf("User")
    );
    expect(REGRESSION_CLEANUP_ORDER.indexOf("Mission")).toBeLessThan(REGRESSION_CLEANUP_ORDER.indexOf("Program"));
    expect(REGRESSION_CLEANUP_ORDER.indexOf("EngineeringJournalEntry")).toBeLessThan(
      REGRESSION_CLEANUP_ORDER.indexOf("MissionAssignment")
    );
  });

  it("does not include unmarkable broad tables in cleanup order", () => {
    expect(REGRESSION_CLEANUP_ORDER).not.toContain("AuditLog" as never);
  });
});
