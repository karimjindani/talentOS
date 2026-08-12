import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseMissionSpecMarkdown, parseMissionSpecMarkdownOrThrow } from "./mission-spec";

const WEEK_ONE_SEED_DIR = resolve("packages/db/prisma/seed-data/missions/ai-native-engineering/week-1");

function spec(overrides: Partial<Record<string, string>> = {}): string {
  const sections: Record<string, string> = {
    Objective: "Ship a deployed waitlist page.",
    "Mission Brief": "A founder is testing demand.\n\nSecond paragraph.",
    Deliverables: "- PRD\n- Deployment URL",
    "Acceptance Criteria": "- The page loads.",
    "Evaluation Criteria": "Bronze: it works.",
    "Competency Tags": "- Problem Discovery\n- Communication",
    ...overrides
  };
  const body = Object.entries(sections)
    .filter(([, value]) => value !== undefined)
    .map(([heading, value]) => `## ${heading}\n\n${value}`)
    .join("\n\n");
  return `# Build a Product Waitlist Page\n\n${body}\n`;
}

describe("parseMissionSpecMarkdown", () => {
  it("maps every section onto a mission field", () => {
    const result = parseMissionSpecMarkdown(spec());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual({
      title: "Build a Product Waitlist Page",
      objective: "Ship a deployed waitlist page.",
      brief: "A founder is testing demand.\n\nSecond paragraph.",
      deliverables: "- PRD\n- Deployment URL",
      acceptanceCriteria: "- The page loads.",
      evaluationCriteria: "Bronze: it works.",
      competencyTags: ["Problem Discovery", "Communication"]
    });
  });

  // The whole point of the result type: an admin fixes one list, not one heading per upload.
  it("reports every missing section at once rather than stopping at the first", () => {
    const withoutTwo = spec()
      .replace(/## Deliverables\n\n- PRD\n- Deployment URL\n\n/, "")
      .replace(/## Evaluation Criteria\n\nBronze: it works\.\n\n/, "");

    const result = parseMissionSpecMarkdown(withoutTwo);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const joined = result.errors.join(" ");
    expect(joined).toContain("## Deliverables");
    expect(joined).toContain("## Evaluation Criteria");
  });

  it("rejects a spec with no level-1 title", () => {
    const result = parseMissionSpecMarkdown(spec().replace("# Build a Product Waitlist Page\n\n", ""));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("level-1 title");
  });

  it("treats a present but blank section as an error, separately from a missing one", () => {
    const result = parseMissionSpecMarkdown(spec({ Objective: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("Empty section");
  });

  it("rejects an empty file", () => {
    const result = parseMissionSpecMarkdown("   \n  ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(["The file is empty."]);
  });

  it("handles CRLF line endings", () => {
    const result = parseMissionSpecMarkdown(spec().replace(/\n/g, "\r\n"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.competencyTags).toEqual(["Problem Discovery", "Communication"]);
    expect(result.value.objective).toBe("Ship a deployed waitlist page.");
  });

  it("reads the final section through to end of file", () => {
    const result = parseMissionSpecMarkdown(spec());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.competencyTags).toHaveLength(2);
  });

  it("ignores preamble before the title", () => {
    const result = parseMissionSpecMarkdown(`<!-- internal note -->\n\n${spec()}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe("Build a Product Waitlist Page");
  });

  it("accepts tag lines with or without bullets", () => {
    const result = parseMissionSpecMarkdown(spec({ "Competency Tags": "- Problem Discovery\nCommunication" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.competencyTags).toEqual(["Problem Discovery", "Communication"]);
  });
});

describe("parseMissionSpecMarkdownOrThrow", () => {
  it("throws with every problem listed", () => {
    expect(() => parseMissionSpecMarkdownOrThrow("# Title only")).toThrow(/Missing sections/);
  });

  // Guards the seed.ts refactor: the shared parser must read the real corpus exactly as before.
  it("parses every real Week 1 seed spec", () => {
    const files = readdirSync(WEEK_ONE_SEED_DIR).filter((file) => file.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(4);

    for (const file of files) {
      const parsed = parseMissionSpecMarkdownOrThrow(readFileSync(resolve(WEEK_ONE_SEED_DIR, file), "utf8"));
      expect(parsed.title, file).toBeTruthy();
      expect(parsed.objective, file).toBeTruthy();
      expect(parsed.brief, file).toBeTruthy();
      expect(parsed.deliverables, file).toBeTruthy();
      expect(parsed.acceptanceCriteria, file).toBeTruthy();
      expect(parsed.evaluationCriteria, file).toBeTruthy();
      expect(parsed.competencyTags.length, file).toBeGreaterThan(0);
      // Tag lines must be clean values, not leftover markdown bullets.
      expect(parsed.competencyTags.some((tag) => tag.startsWith("-")), file).toBe(false);
    }
  });
});
