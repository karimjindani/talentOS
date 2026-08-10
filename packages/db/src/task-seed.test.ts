import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEEK_ONE_TASK_DIR = resolve(
  "packages/db/prisma/seed-data/tasks/ai-native-engineering/week-1"
);
const DASHBOARD_SEED = readFileSync(resolve("scripts/seed-dashboard.ts"), "utf8");

const TASK_GUIDES = [
  ["Environment Setup", "introduction-to-talentos.md"],
  ["Git and GitHub Basics", "git-and-github-basics.md"],
  ["Introduction to AI-Assisted Coding", "ai-assisted-coding.md"]
] as const;

describe("Week 1 task seed material", () => {
  it("provides three required published tasks with Markdown source guides", () => {
    for (const [title, file] of TASK_GUIDES) {
      const markdown = readFileSync(resolve(WEEK_ONE_TASK_DIR, file), "utf8");

      expect(DASHBOARD_SEED).toContain(`title: "${title}"`);
      expect(markdown).toMatch(/^#\s+.+/m);
      expect(markdown).toContain("##");
    }

    expect(DASHBOARD_SEED).toContain("required: true");
    expect(DASHBOARD_SEED).toContain("published: true");
  });

  it("keeps YouTube links pending and includes the internal video outline", () => {
    const videoOutline = readFileSync(
      resolve(WEEK_ONE_TASK_DIR, "introduction-to-talentos-video-script.md"),
      "utf8"
    );

    expect(DASHBOARD_SEED).toContain('type: "YOUTUBE" as const');
    expect(DASHBOARD_SEED).toMatch(/type: "YOUTUBE" as const,[\s\S]*?url: null/);
    expect(videoOutline).toContain("final YouTube URL pending");
    expect(videoOutline).toContain("NotebookLM outside TalentOS");
    expect(videoOutline).toContain("at least four current-attempt journal entries");
  });
});
