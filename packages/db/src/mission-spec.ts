/**
 * Mission spec Markdown (v0.20.0).
 *
 * Missions are authored as documents, not as thirteen browser textareas. The seed corpus under
 * `prisma/seed-data/missions/` has always followed a fixed section convention, and `seed.ts` carried
 * a private parser for it. Promoting that parser here lets the Back Office import the very same
 * files, so a spec written for seeding and a spec uploaded by an admin cannot drift apart.
 *
 * Deliberately free of Prisma imports: it is pure string handling, which keeps it cheap to test and
 * safe to call from anywhere.
 */

export type MissionSpecFields = {
  title: string;
  objective: string;
  brief: string;
  deliverables: string;
  acceptanceCriteria: string;
  evaluationCriteria: string;
  competencyTags: string[];
};

export type MissionSpecParseResult =
  | { ok: true; value: MissionSpecFields }
  | { ok: false; errors: string[] };

/** Heading text (without the `## `) for each long-form field, in document order. */
const SECTION_HEADINGS = {
  objective: "Objective",
  brief: "Mission Brief",
  deliverables: "Deliverables",
  acceptanceCriteria: "Acceptance Criteria",
  evaluationCriteria: "Evaluation Criteria"
} as const;

const COMPETENCY_TAGS_HEADING = "Competency Tags";

/**
 * Parse a mission spec, collecting *every* problem rather than stopping at the first.
 *
 * An admin uploading a file wants one list of what to fix, not a fix-upload-repeat loop, so this
 * reports all missing or empty sections together.
 */
export function parseMissionSpecMarkdown(markdown: string): MissionSpecParseResult {
  const errors: string[] = [];

  if (!markdown.trim()) {
    return { ok: false, errors: ["The file is empty."] };
  }

  const title = findTitle(markdown);
  if (!title) {
    errors.push("Missing a level-1 title line (`# Mission title`).");
  }

  const missing: string[] = [];
  const empty: string[] = [];
  const sections: Record<string, string> = {};

  for (const heading of [...Object.values(SECTION_HEADINGS), COMPETENCY_TAGS_HEADING]) {
    const body = findSection(markdown, heading);
    if (body === null) {
      missing.push(`## ${heading}`);
      continue;
    }
    if (!body) {
      empty.push(`## ${heading}`);
      continue;
    }
    sections[heading] = body;
  }

  if (missing.length > 0) {
    errors.push(`Missing section${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  }
  if (empty.length > 0) {
    errors.push(`Empty section${empty.length === 1 ? "" : "s"}: ${empty.join(", ")}.`);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title: title as string,
      objective: sections[SECTION_HEADINGS.objective],
      brief: sections[SECTION_HEADINGS.brief],
      deliverables: sections[SECTION_HEADINGS.deliverables],
      acceptanceCriteria: sections[SECTION_HEADINGS.acceptanceCriteria],
      evaluationCriteria: sections[SECTION_HEADINGS.evaluationCriteria],
      competencyTags: toList(sections[COMPETENCY_TAGS_HEADING])
    }
  };
}

/** Throwing variant for the seed script, where a malformed spec should stop the seed outright. */
export function parseMissionSpecMarkdownOrThrow(markdown: string): MissionSpecFields {
  const result = parseMissionSpecMarkdown(markdown);
  if (!result.ok) {
    throw new Error(`Invalid mission spec. ${result.errors.join(" ")}`);
  }
  return result.value;
}

function findTitle(markdown: string): string | null {
  const title = markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();
  return title ? title : null;
}

/** Section body, or null when the heading is absent. An empty string means present but blank. */
function findSection(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    return null;
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}

function toList(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^-\s+/, ""))
    .filter(Boolean);
}
