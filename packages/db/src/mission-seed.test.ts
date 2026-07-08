import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEEK_ONE_SEED_DIR = resolve("packages/db/prisma/seed-data/missions/ai-native-engineering/week-1");
const REQUIRED_SECTIONS = [
  "## Objective",
  "## Mission Brief",
  "## Deliverables",
  "## Acceptance Criteria",
  "## Evaluation Criteria",
  "## Competency Tags"
];

describe("mission seed Markdown specs", () => {
  it("provides multiple complete Week 1 assignment variants", () => {
    const files = readdirSync(WEEK_ONE_SEED_DIR).filter((file) => file.endsWith(".md"));

    expect(files.length).toBeGreaterThanOrEqual(4);

    const titles = new Set<string>();
    for (const file of files) {
      const content = readFileSync(resolve(WEEK_ONE_SEED_DIR, file), "utf8");
      const title = content.match(/^#\s+(.+)$/m)?.[1];
      expect(title, `${file} is missing a title`).toBeTruthy();
      titles.add(title!);

      for (const section of REQUIRED_SECTIONS) {
        expect(content, `${file} is missing ${section}`).toContain(section);
      }
    }

    expect(titles.size).toBe(files.length);
  });
});
