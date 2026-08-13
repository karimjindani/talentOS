// tests/journeys/fixtures/keycloak.test.ts
import { describe, expect, it } from "vitest";
import { isJourneyEmail, journeyEmail, orphanCutoff } from "./keycloak";

describe("journeyEmail", () => {
  it("builds a run-scoped address so concurrent runs cannot collide", () => {
    expect(journeyEmail("abc123", "applicant")).toBe("journey-abc123-applicant@journeys.talentos.local");
  });
});

describe("isJourneyEmail", () => {
  it("matches addresses this suite creates", () => {
    expect(isJourneyEmail("journey-abc123-applicant@journeys.talentos.local")).toBe(true);
  });

  it("never matches seeded or real users", () => {
    for (const email of [
      "applicant@demo.talentos.local",
      "accepted@demo.talentos.local",
      "superadmin@talentos.local",
      "notjourney-abc@journeys.talentos.local"
    ]) {
      expect(isJourneyEmail(email)).toBe(false);
    }
  });
});

describe("orphanCutoff", () => {
  it("is 24 hours before now, so a run in flight is never reaped", () => {
    expect(orphanCutoff(new Date("2026-08-13T12:00:00.000Z")).toISOString()).toBe("2026-08-12T12:00:00.000Z");
  });
});
