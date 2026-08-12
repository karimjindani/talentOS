import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ assignmentFindMany: vi.fn() }));

vi.mock("./client", () => ({
  prisma: { missionAssignment: { findMany: prismaMock.assignmentFindMany } }
}));

import { formatEvaluationSummaryForPrompt, getApplicantEvaluationSummary } from "./evaluation";

const input = { tenantId: "tenant-1", applicantId: "applicant-1", programId: "program-1" };

/** The scenario this feature exists for: four weeks completed, but not all equally. */
function fourWeekJourney() {
  return [
    {
      missionId: "m1", weekNumber: 1, attemptNumber: 1, status: "PASSED",
      reviewOutcome: "ACCEPTED_FIRST_TIME", revisionCount: 0,
      mission: { title: "Waitlist Page" },
      reviews: [{ round: 1, decision: "ACCEPTED", feedback: "Clean.", createdAt: new Date("2026-07-16") }]
    },
    // Week 2 passed, but only after the reviewer asked for changes.
    {
      missionId: "m2", weekNumber: 2, attemptNumber: 1, status: "PASSED",
      reviewOutcome: "ACCEPTED_AFTER_CHANGES", revisionCount: 1,
      mission: { title: "TaskPilot" },
      reviews: [
        { round: 1, decision: "CHANGES_REQUESTED", feedback: "Journals are stale.", createdAt: new Date("2026-07-20") },
        { round: 2, decision: "ACCEPTED", feedback: "Resolved.", createdAt: new Date("2026-07-21") }
      ]
    },
    // Week 3 was repeated: attempt 1 closed as REPEAT, attempt 2 on a different mission passed.
    {
      missionId: "m3", weekNumber: 3, attemptNumber: 1, status: "REPEAT",
      reviewOutcome: "REPEATED", revisionCount: 0,
      mission: { title: "Team Workflow" },
      reviews: [{ round: 1, decision: "REPEAT", feedback: "Not enough evidence.", createdAt: new Date("2026-07-28") }]
    },
    {
      missionId: "m3b", weekNumber: 3, attemptNumber: 2, status: "PASSED",
      reviewOutcome: "ACCEPTED_FIRST_TIME", revisionCount: 0,
      mission: { title: "Team Workflow (Alt)" },
      reviews: [{ round: 1, decision: "ACCEPTED", feedback: "Much better.", createdAt: new Date("2026-08-02") }]
    },
    {
      missionId: "m4", weekNumber: 4, attemptNumber: 1, status: "PASSED",
      reviewOutcome: "ACCEPTED_FIRST_TIME", revisionCount: 0,
      mission: { title: "Production Launch" },
      reviews: [{ round: 1, decision: "ACCEPTED", feedback: null, createdAt: new Date("2026-08-06") }]
    }
  ];
}

describe("getApplicantEvaluationSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.assignmentFindMany.mockResolvedValue(fourWeekJourney());
  });

  it("scopes the query to tenant, applicant and program", async () => {
    await getApplicantEvaluationSummary(input);
    expect(prismaMock.assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", applicantId: "applicant-1", programId: "program-1" },
        orderBy: [{ weekNumber: "asc" }, { attemptNumber: "asc" }]
      })
    );
  });

  it("distinguishes a clean pass from one that needed changes and one that needed a repeat", async () => {
    const summary = await getApplicantEvaluationSummary(input);

    expect(summary.weeks.map((week) => week.weekNumber)).toEqual([1, 2, 3, 4]);
    expect(summary.weeks[0]).toMatchObject({ repeated: false, totalRevisions: 0, finalOutcome: "ACCEPTED_FIRST_TIME", passed: true });
    expect(summary.weeks[1]).toMatchObject({ repeated: false, totalRevisions: 1, finalOutcome: "ACCEPTED_AFTER_CHANGES", passed: true });
    // Week 3 passed overall, but only on the second attempt — both facts must survive.
    expect(summary.weeks[2]).toMatchObject({ repeated: true, passed: true, finalOutcome: "ACCEPTED_FIRST_TIME" });
    expect(summary.weeks[2].attempts).toHaveLength(2);
    expect(summary.weeks[2].attempts[0]).toMatchObject({ attemptNumber: 1, outcome: "REPEATED" });
  });

  it("keeps reviewer feedback, the strongest evaluation signal", async () => {
    const summary = await getApplicantEvaluationSummary(input);
    expect(summary.weeks[1].attempts[0].reviews.map((review) => review.feedback)).toEqual([
      "Journals are stale.",
      "Resolved."
    ]);
  });

  it("totals the journey without counting a repeated week as a first-time pass", async () => {
    const summary = await getApplicantEvaluationSummary(input);
    expect(summary.totals).toEqual({
      weeksAttempted: 4,
      weeksPassed: 4,
      weeksRepeated: 1,
      weeksAcceptedFirstTime: 2, // weeks 1 and 4 — not week 3, which was repeated
      totalRevisions: 1
    });
  });

  it("returns an empty summary for an applicant with no assignments", async () => {
    prismaMock.assignmentFindMany.mockResolvedValue([]);
    const summary = await getApplicantEvaluationSummary(input);
    expect(summary.weeks).toEqual([]);
    expect(summary.totals.weeksAttempted).toBe(0);
  });
});

describe("formatEvaluationSummaryForPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.assignmentFindMany.mockResolvedValue(fourWeekJourney());
  });

  it("spells out the sequence rather than leaving the model to infer it", async () => {
    const text = formatEvaluationSummaryForPrompt(await getApplicantEvaluationSummary(input));
    expect(text).toContain("Week 2:");
    expect(text).toContain("reviews: CHANGES_REQUESTED -> ACCEPTED");
    // The assignment lifecycle also has an ACCEPTED state; it must not read as a passing review.
    expect(text).toContain("assignment status:");
    expect(text).toContain("week repeated");
    expect(text).toContain("4/4 weeks passed");
    expect(text).toContain("2 accepted first time");
  });

  it("handles an applicant with no history", async () => {
    prismaMock.assignmentFindMany.mockResolvedValue([]);
    expect(formatEvaluationSummaryForPrompt(await getApplicantEvaluationSummary(input))).toBe(
      "No mission history yet."
    );
  });
});
