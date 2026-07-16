import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS, type NavItem } from "./SidebarNav";

const ORGANIZATIONS_ITEM: NavItem = { href: "/organizations", label: "Organizations" };

describe("SidebarNav isActive route matching", () => {
  describe("exact-match routes (Overview — `/`)", () => {
    const overview = NAV_ITEMS.find((i) => i.href === "/")!;

    it("is active only on exactly `/`", () => {
      expect(isActive("/", overview)).toBe(true);
    });

    it("is not active on any sub-path", () => {
      expect(isActive("/applications", overview)).toBe(false);
      expect(isActive("/programs", overview)).toBe(false);
      expect(isActive("/missions", overview)).toBe(false);
      expect(isActive("/submissions", overview)).toBe(false);
      expect(isActive("/operations", overview)).toBe(false);
      expect(isActive("/settings", overview)).toBe(false);
      expect(isActive("/organizations", overview)).toBe(false);
    });
  });

  describe("startsWith-match routes", () => {
    it("Applications is active on `/applications` and nested `/applications/[id]`", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/applications")!;
      expect(isActive("/applications", item)).toBe(true);
      expect(isActive("/applications/abc123", item)).toBe(true);
      expect(isActive("/applications/cmr4tlodz0008p808kk3hbe11", item)).toBe(true);
    });

    it("Programs is active on `/programs` and nested `/programs/[id]`", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/programs")!;
      expect(isActive("/programs", item)).toBe(true);
      expect(isActive("/programs/xyz", item)).toBe(true);
    });

    it("Missions is active on `/missions` and nested `/missions/[id]`", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/missions")!;
      expect(isActive("/missions", item)).toBe(true);
      expect(isActive("/missions/xyz", item)).toBe(true);
    });

    it("Submissions is active on `/submissions` and nested paths", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/submissions")!;
      expect(isActive("/submissions", item)).toBe(true);
      expect(isActive("/submissions/xyz", item)).toBe(true);
    });

    it("Operations is active on `/operations` only", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/operations")!;
      expect(isActive("/operations", item)).toBe(true);
    });

    it("Settings is active on `/settings` only", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/settings")!;
      expect(isActive("/settings", item)).toBe(true);
    });

    it("Organizations is active on `/organizations` and nested paths", () => {
      expect(isActive("/organizations", ORGANIZATIONS_ITEM)).toBe(true);
      expect(isActive("/organizations/abc", ORGANIZATIONS_ITEM)).toBe(true);
    });
  });

  describe("cross-route isolation (no false positives)", () => {
    it("Applications is not active on Overview or other top-level routes", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/applications")!;
      expect(isActive("/", item)).toBe(false);
      expect(isActive("/programs", item)).toBe(false);
      expect(isActive("/missions", item)).toBe(false);
      expect(isActive("/operations", item)).toBe(false);
      expect(isActive("/settings", item)).toBe(false);
    });

    it("Programs is not active on Applications or other top-level routes", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/programs")!;
      expect(isActive("/", item)).toBe(false);
      expect(isActive("/applications", item)).toBe(false);
      expect(isActive("/applications/123", item)).toBe(false);
      expect(isActive("/missions", item)).toBe(false);
    });

    it("Missions is not active on Submissions or other top-level routes", () => {
      const item = NAV_ITEMS.find((i) => i.href === "/missions")!;
      expect(isActive("/submissions", item)).toBe(false);
      expect(isActive("/operations", item)).toBe(false);
    });

    it("no item is active on an unknown route", () => {
      for (const item of NAV_ITEMS) {
        expect(isActive("/unknown-route", item)).toBe(false);
      }
      expect(isActive("/unknown-route", ORGANIZATIONS_ITEM)).toBe(false);
    });
  });

  describe("NAV_ITEMS integrity", () => {
    it("contains the seven standard admin nav items in order", () => {
      expect(NAV_ITEMS.map((i) => i.label)).toEqual([
        "Overview",
        "Applications",
        "Programs",
        "Missions",
        "Submissions",
        "Operations",
        "Settings"
      ]);
    });

    it("only Overview uses exact matching", () => {
      const exactItems = NAV_ITEMS.filter((i) => i.exact);
      expect(exactItems).toHaveLength(1);
      expect(exactItems[0].href).toBe("/");
    });
  });
});
