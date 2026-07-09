import { describe, expect, it, vi } from "vitest";

// The shell imports the shared logout server action (v0.14.3 / D-066); mock it — like @/auth in
// tenant-guard.test.ts — because vitest does not resolve the app-level "@/" alias.
vi.mock("@/lib/logout-action", () => ({ logoutAction: vi.fn() }));

import { isApplicantNavActive, APPLICANT_NAV_ITEMS } from "./ApplicantShell";

describe("ApplicantShell isApplicantNavActive route matching", () => {
  describe("exact-match routes (Dashboard — `/dashboard`)", () => {
    const dashboard = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard")!;

    it("is active only on exactly `/dashboard`", () => {
      expect(isApplicantNavActive("/dashboard", dashboard)).toBe(true);
    });

    it("is not active on any sub-path", () => {
      expect(isApplicantNavActive("/dashboard/program", dashboard)).toBe(false);
      expect(isApplicantNavActive("/dashboard/missions", dashboard)).toBe(false);
      expect(isApplicantNavActive("/dashboard/tasks", dashboard)).toBe(false);
      expect(isApplicantNavActive("/dashboard/notifications", dashboard)).toBe(false);
    });
  });

  describe("startsWith-match routes", () => {
    it("My Program is active on `/dashboard/program` only", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/program")!;
      expect(isApplicantNavActive("/dashboard/program", item)).toBe(true);
      expect(isApplicantNavActive("/dashboard/tasks", item)).toBe(false);
    });

    it("Tasks is active on `/dashboard/tasks` only", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/tasks")!;
      expect(isApplicantNavActive("/dashboard/tasks", item)).toBe(true);
      expect(isApplicantNavActive("/dashboard/program", item)).toBe(false);
    });

    it("Missions is active on `/dashboard/missions` and mission detail pages", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/missions")!;
      expect(isApplicantNavActive("/dashboard/missions", item)).toBe(true);
      expect(isApplicantNavActive("/dashboard/missions/mission-1", item)).toBe(true);
      expect(isApplicantNavActive("/dashboard/tasks", item)).toBe(false);
    });

    it("Journal is active on `/dashboard/journal` and journal detail pages", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/journal")!;
      expect(isApplicantNavActive("/dashboard/journal", item)).toBe(true);
      expect(isApplicantNavActive("/dashboard/journal/journal-1", item)).toBe(true);
      expect(isApplicantNavActive("/dashboard/missions", item)).toBe(false);
    });

    it("Resources is active on `/dashboard/resources` only", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/resources")!;
      expect(isApplicantNavActive("/dashboard/resources", item)).toBe(true);
    });

    it("Calendar is active on `/dashboard/calendar` only", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/calendar")!;
      expect(isApplicantNavActive("/dashboard/calendar", item)).toBe(true);
    });

    it("Notifications is active on `/dashboard/notifications` only", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/notifications")!;
      expect(isApplicantNavActive("/dashboard/notifications", item)).toBe(true);
    });

    it("Profile is active on `/dashboard/profile` only", () => {
      const item = APPLICANT_NAV_ITEMS.find((i) => i.href === "/dashboard/profile")!;
      expect(isApplicantNavActive("/dashboard/profile", item)).toBe(true);
    });
  });

  describe("nav items completeness", () => {
    it("has exactly 8 nav items", () => {
      expect(APPLICANT_NAV_ITEMS).toHaveLength(9);
    });

    it("includes all expected routes", () => {
      const hrefs = APPLICANT_NAV_ITEMS.map((i) => i.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/dashboard/program");
      expect(hrefs).toContain("/dashboard/missions");
      expect(hrefs).toContain("/dashboard/journal");
      expect(hrefs).toContain("/dashboard/tasks");
      expect(hrefs).toContain("/dashboard/resources");
      expect(hrefs).toContain("/dashboard/calendar");
      expect(hrefs).toContain("/dashboard/notifications");
      expect(hrefs).toContain("/dashboard/profile");
    });
  });
});
