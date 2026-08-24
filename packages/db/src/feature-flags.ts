import { prisma } from "./client";

/**
 * Feature flags (v0.20.8): runtime toggles controllable from the Ops console.
 *
 * Key used to relax journal entry restrictions for local testing:
 * - `journal.testing_mode` — when enabled, journal create/update skip the date-conflict (one entry
 *   per mission per date), future-date, before-mission-start, and locked-after-submission checks,
 *   and the submission readiness gate no longer requires 4 journal entries.
 */
export const JOURNAL_TESTING_MODE_FLAG = "journal.testing_mode";

/** Well-known flags surfaced by the Ops console. */
export const KNOWN_FEATURE_FLAGS: Array<{ key: string; description: string }> = [
  {
    key: JOURNAL_TESTING_MODE_FLAG,
    description:
      "Relax journal entry restrictions for testing: allow multiple entries per mission per day, future and pre-mission dates, editing locked entries, and skip the 4-entry submission gate."
  }
];

/** Whether a feature flag is currently enabled. Unknown flags default to false. */
export async function isFeatureFlagEnabled(key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
  return flag?.enabled ?? false;
}

/** List all feature flags, newest first. */
export function listFeatureFlags() {
  return prisma.featureFlag.findMany({ orderBy: { updatedAt: "desc" } });
}

/** Create or update a feature flag. Passing `description` updates it; omitting it keeps the old. */
export function setFeatureFlag(key: string, enabled: boolean, description?: string) {
  return prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, ...(description !== undefined ? { description } : {}) },
    create: { key, enabled, description: description ?? null }
  });
}

/** Delete a feature flag (resets it to the default off state). */
export function deleteFeatureFlag(key: string) {
  return prisma.featureFlag.delete({ where: { key } });
}
