import type { Actor, JourneyStepRecord } from "./types";

const MAX_FILENAME_LENGTH = 64;

/** `01-applicant-signs-up.png` — ordered, readable, and safe on every filesystem. */
export function screenshotFilename(index: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = String(index).padStart(2, "0");
  const budget = MAX_FILENAME_LENGTH - prefix.length - ".png".length - 1;
  return `${prefix}-${slug.slice(0, budget).replace(/-+$/, "")}.png`;
}

export function buildStepRecord(input: {
  index: number;
  name: string;
  actor: Actor;
  proves: string;
  durationMs: number;
  error: string | null;
}): JourneyStepRecord {
  const failed = input.error !== null;
  return {
    index: input.index,
    name: input.name,
    actor: input.actor,
    proves: input.proves,
    status: failed ? "failed" : "passed",
    durationMs: input.durationMs,
    screenshot: failed ? null : screenshotFilename(input.index, input.name),
    ...(failed ? { error: input.error as string } : {})
  };
}

/** A journey with no steps is a failure, not a vacuous pass. */
export function journeyStatus(steps: JourneyStepRecord[]): "passed" | "failed" {
  if (steps.length === 0) return "failed";
  return steps.every((step) => step.status === "passed") ? "passed" : "failed";
}
