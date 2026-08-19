// tests/journeys/fixtures/keycloak.test.ts
import { describe, expect, it } from "vitest";
import { isJourneyEmail, journeyEmail, orphanCutoff, shouldReapUser } from "./keycloak";

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

describe("shouldReapUser", () => {
  const cutoffMs = new Date("2026-08-12T12:00:00.000Z").getTime();
  const oldTimestamp = new Date("2026-08-01T00:00:00.000Z").getTime();
  const newTimestamp = new Date("2026-08-13T00:00:00.000Z").getTime();

  it("reaps a journey user older than the cutoff", () => {
    expect(
      shouldReapUser({ email: "journey-abc123-applicant@journeys.talentos.local", createdTimestamp: oldTimestamp }, cutoffMs)
    ).toBe(true);
  });

  it("preserves a journey user newer than the cutoff", () => {
    expect(
      shouldReapUser({ email: "journey-abc123-applicant@journeys.talentos.local", createdTimestamp: newTimestamp }, cutoffMs)
    ).toBe(false);
  });

  it("preserves a journey user with a MISSING timestamp (fail safe, not toward deletion)", () => {
    expect(shouldReapUser({ email: "journey-abc123-applicant@journeys.talentos.local" }, cutoffMs)).toBe(false);
  });

  it("never reaps a non-journey email, even if very old", () => {
    expect(shouldReapUser({ email: "superadmin@talentos.local", createdTimestamp: oldTimestamp }, cutoffMs)).toBe(false);
  });

  it("never reaps a user with a missing email", () => {
    expect(shouldReapUser({ createdTimestamp: oldTimestamp }, cutoffMs)).toBe(false);
  });
});
