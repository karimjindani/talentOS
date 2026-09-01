import { describe, expect, it } from "vitest";
import {
  buildProcessReportHtml,
  flattenSteps,
  groupByProcess,
  groupByScope,
  type JourneyRecord,
  type ProcessReportInput,
  type ScenarioResult
} from "./journey-pdf-report";
import { PLATFORM, SCOPE } from "../lib/evidence-taxonomy";

const record: JourneyRecord = {
  journey: "applicant-arc",
  runId: "abc123",
  startedAt: "2026-08-13T10:00:00.000Z",
  durationMs: 42_000,
  status: "passed" as const,
  steps: [
    {
      index: 1,
      name: "Applicant signs up",
      actor: "applicant" as const,
      process: "Applicant Signup & Approval" as const,
      proves: "Creates a user",
      status: "passed" as const,
      durationMs: 2400,
      screenshot: "01-applicant-signs-up.png"
    }
  ]
};

const noResolver = () => null;

function items(records: JourneyRecord[]) {
  return flattenSteps(records);
}

/** A report input with everything empty but the fields under test. */
function input(overrides: Partial<ProcessReportInput> = {}): ProcessReportInput {
  return {
    process: "Applicant Signup & Approval",
    index: 1,
    total: 5,
    steps: items([record]),
    scenarios: [],
    platform: [],
    gaps: [],
    regressionRunId: null,
    journeyEvidenceMissing: false,
    regressionEvidenceMissing: false,
    ...overrides
  };
}

function scenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    id: "TOS-APP-01",
    area: "applicant",
    scopes: [SCOPE.ASA],
    name: "Applicant application lifecycle blocks a duplicate",
    status: "passed",
    durationMs: 372,
    ...overrides
  };
}

describe("flattenSteps / groupByProcess", () => {
  it("groups steps from multiple records by their process tag, preserving order", () => {
    const second = {
      ...record,
      journey: "recruiter-access",
      runId: "def456",
      steps: [{ ...record.steps[0], index: 1, process: "Recruiter Journey" as const }]
    };
    const groups = groupByProcess(items([record, second]));
    expect(groups.get("Applicant Signup & Approval")).toHaveLength(1);
    expect(groups.get("Recruiter Journey")).toHaveLength(1);
    expect(groups.get("Mission Acceptance & Journal")).toHaveLength(0);
  });

  it("drops a step whose process tag matches no known process, rather than throwing", () => {
    const stray = { ...record, steps: [{ ...record.steps[0], process: "Something Unknown" as never }] };
    const groups = groupByProcess(items([stray]));
    for (const bucket of groups.values()) expect(bucket).toHaveLength(0);
  });
});

describe("groupByScope", () => {
  it("files a scenario into every scope it declares, not just the first", () => {
    const dual = scenario({ id: "TOS-PUB-10", scopes: [SCOPE.FMP, SCOPE.RJ] });
    const groups = groupByScope([dual]);
    expect(groups.get("Final Mission & Public Profile")).toHaveLength(1);
    expect(groups.get("Recruiter Journey")).toHaveLength(1);
    expect(groups.get("Applicant Signup & Approval")).toHaveLength(0);
  });

  it("keeps platform-scoped rows out of every business process bucket", () => {
    const groups = groupByScope([scenario({ id: "TOS-OPS-01", area: "ops", scopes: [PLATFORM] })]);
    expect(groups.get(PLATFORM)).toHaveLength(1);
    for (const name of ["Applicant Signup & Approval", "Recruiter Journey"] as const) {
      expect(groups.get(name)).toHaveLength(0);
    }
  });

  it("drops an untagged or unknown-scope result rather than guessing a process for it", () => {
    const groups = groupByScope([scenario({ scopes: undefined }), scenario({ scopes: ["Invented"] })]);
    for (const bucket of groups.values()) expect(bucket).toHaveLength(0);
  });

  it("sorts failures ahead of skips ahead of passes", () => {
    const rows = [
      scenario({ id: "TOS-APP-01", status: "passed" }),
      scenario({ id: "TOS-APP-02", status: "skipped" }),
      scenario({ id: "TOS-APP-03", status: "failed" })
    ];
    const sorted = groupByScope(rows).get("Applicant Signup & Approval");
    expect(sorted?.map((row) => row.status)).toEqual(["failed", "skipped", "passed"]);
  });
});

describe("buildProcessReportHtml", () => {
  it("leads with the process name, its position, and a summary of steps/pass rate", () => {
    const html = buildProcessReportHtml(input(), noResolver);
    expect(html).toContain("Applicant Signup &amp; Approval");
    expect(html).toContain("Process 1 of 5");
    expect(html).toContain(">1<"); // total steps stat
    expect(html).toContain("100%");
  });

  it("renders a step card with actor pill, name, proves text and a passed result", () => {
    const html = buildProcessReportHtml(input(), noResolver);
    expect(html).toContain("actor-applicant");
    expect(html).toContain("Applicant signs up");
    expect(html).toContain("Creates a user");
    expect(html).toContain("Passed · 2.4s");
  });

  it("embeds the resolved screenshot data URI for a passed step", () => {
    const html = buildProcessReportHtml(input(), (journey, runId, filename) => {
      expect(journey).toBe("applicant-arc");
      expect(runId).toBe("abc123");
      expect(filename).toBe("01-applicant-signs-up.png");
      return "data:image/png;base64,AAAA";
    });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("shows a missing-screenshot note rather than a broken image when the resolver returns null", () => {
    const html = buildProcessReportHtml(input(), noResolver);
    expect(html).toContain("No screenshot was captured for this step.");
    expect(html).not.toContain("<img");
  });

  it("shows the error text instead of an image for a failed step, and never tries to resolve its screenshot", () => {
    const failed = {
      ...record,
      status: "failed" as const,
      steps: [{ ...record.steps[0], status: "failed" as const, screenshot: null, error: "Timed out waiting for selector" }]
    };
    const html = buildProcessReportHtml(input({ steps: items([failed]) }), () => {
      throw new Error("must not be called for a failed step");
    });
    expect(html).toContain("Timed out waiting for selector");
    expect(html).toContain("Failed");
  });

  it("escapes HTML-significant characters in step names, claims and errors", () => {
    const withHtml = {
      ...record,
      steps: [{ ...record.steps[0], name: '<script>alert("x")</script>', proves: "a < b & c" }]
    };
    const html = buildProcessReportHtml(input({ steps: items([withHtml]) }), noResolver);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &lt; b &amp; c");
  });

  it("escapes HTML in scenario names and recorded detail too", () => {
    const html = buildProcessReportHtml(
      input({ scenarios: [scenario({ name: "<script>alert(1)</script>", detail: "a < b & c" })] }),
      noResolver
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &lt; b &amp; c");
  });

  it("renders a readable placeholder rather than crashing when the process has no steps at all", () => {
    const html = buildProcessReportHtml(input({ process: "Recruiter Journey", index: 5, steps: [] }), noResolver);
    expect(html).toContain("No steps were recorded for this process");
    expect(html).toContain(">0<");
  });

  it("computes a partial pass rate and marks the failed-count stat when some steps fail", () => {
    const mixed = {
      ...record,
      status: "failed" as const,
      steps: [
        record.steps[0],
        { ...record.steps[0], index: 2, status: "failed" as const, screenshot: null, error: "boom" }
      ]
    };
    const html = buildProcessReportHtml(input({ steps: items([mixed]) }), noResolver);
    expect(html).toContain("50%");
    expect(html).toContain('class="stat fail"');
  });

  it("counts a failed scenario against the same pass rate as the journey steps", () => {
    const html = buildProcessReportHtml(input({ scenarios: [scenario({ status: "failed", error: "boom" })] }), noResolver);
    // 1 passed step + 1 failed scenario = 50%.
    expect(html).toContain("50%");
    expect(html).toContain('class="stat fail"');
  });

  it("renders the test case sheet with each scenario's TC ID and status", () => {
    const html = buildProcessReportHtml(input({ scenarios: [scenario()] }), noResolver);
    expect(html).toContain("Test Case Sheet");
    expect(html).toContain("TOS-APP-01");
    expect(html).toContain("Applicant application lifecycle blocks a duplicate");
    expect(html).toContain('<span class="badge pass">Pass</span>');
  });

  it("excludes a skipped scenario from the pass rate rather than treating a documented skip as a failure", () => {
    const html = buildProcessReportHtml(
      input({ scenarios: [scenario({ status: "skipped", error: "Browser automation is not wired up." })] }),
      noResolver
    );
    // The one passed step is the only rated item, so the process is still at 100%.
    expect(html).toContain("100%");
    expect(html).not.toContain('class="stat fail"');
    expect(html).toContain('<span class="badge skip">Skip</span>');
  });

  it("repeats the platform block in a report whose process has no platform steps of its own", () => {
    const html = buildProcessReportHtml(
      input({ platform: [scenario({ id: "TOS-OPS-01", area: "ops", scopes: [PLATFORM], name: "Ops Console login" })] }),
      noResolver
    );
    expect(html).toContain("Platform Preconditions");
    expect(html).toContain("TOS-OPS-01");
    expect(html).toContain("Ops Console login");
  });

  it("lists a skipped scenario's reason and the curated gaps under Known Gaps", () => {
    const html = buildProcessReportHtml(
      input({
        scenarios: [scenario({ status: "skipped", error: "MinIO browser upload is not automated." })],
        gaps: ["Reviewer rejection paths have no scenario coverage."]
      }),
      noResolver
    );
    expect(html).toContain("Known Gaps");
    expect(html).toContain("MinIO browser upload is not automated.");
    expect(html).toContain("Reviewer rejection paths have no scenario coverage.");
  });

  it("puts failure text and recorded scenario detail in the appendix", () => {
    const html = buildProcessReportHtml(
      input({
        scenarios: [
          scenario({ id: "TOS-APP-02", status: "failed", error: "expected 200, got 500" }),
          scenario({ id: "TOS-APP-03", detail: "Thursday deadline with 4 working days." })
        ]
      }),
      noResolver
    );
    expect(html).toContain("Failures &amp; Recorded Detail");
    expect(html).toContain("expected 200, got 500");
    expect(html).toContain("Thursday deadline with 4 working days.");
  });

  it("still renders a full report from scenarios alone when no journey evidence exists", () => {
    const html = buildProcessReportHtml(
      input({ steps: [], scenarios: [scenario()], journeyEvidenceMissing: true }),
      noResolver
    );
    expect(html).toContain("No journey result file was produced");
    expect(html).toContain("TOS-APP-01");
    expect(html).toContain('class="note warn"');
  });

  it("still renders a full report from journey steps alone when no regression evidence exists", () => {
    const html = buildProcessReportHtml(input({ regressionEvidenceMissing: true }), noResolver);
    expect(html).toContain("No regression result file was found");
    expect(html).toContain("Applicant signs up");
    expect(html).toContain('class="note warn"');
  });

  it("names both run ids in the header when both evidence layers are present", () => {
    const html = buildProcessReportHtml(input({ regressionRunId: "regression-20260901120000-abcd1234" }), noResolver);
    expect(html).toContain("journey run abc123");
    expect(html).toContain("scenario run regression-20260901120000-abcd1234");
  });
});
