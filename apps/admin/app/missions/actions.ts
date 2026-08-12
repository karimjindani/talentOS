"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertMissionStatusTransition,
  assertTenantScopedAccess,
  type MissionStatus
} from "@talentos/auth";
import {
  createMission,
  getTenantMission,
  parseMissionSpecMarkdown,
  setMissionStatus,
  updateMission,
  type MissionDifficulty
} from "@talentos/db";
import { requireTenantAccess } from "@/lib/tenant-guard";

const MISSION_STATUSES: MissionStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const MISSION_DIFFICULTIES: MissionDifficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

async function requireMissionManager() {
  return requireTenantAccess("manageMissions");
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseDifficulty(value: FormDataEntryValue | null): MissionDifficulty {
  const input = String(value ?? "BEGINNER") as MissionDifficulty;
  return MISSION_DIFFICULTIES.includes(input) ? input : "BEGINNER";
}

function parseStatus(value: FormDataEntryValue | null): MissionStatus {
  const input = String(value ?? "DRAFT") as MissionStatus;
  return MISSION_STATUSES.includes(input) ? input : "DRAFT";
}

/** Rejects javascript:/data: etc. — this link is rendered as a raw <a href> on the applicant portal. */
function parseOptionalHttpUrl(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Tutorial URL must be a valid URL (including https://).");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Tutorial URL must use http or https.");
  }
  return url.toString();
}

function readMissionForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    throw new Error("A mission title is required.");
  }
  const programId = String(formData.get("programId") ?? "").trim();
  if (!programId) {
    throw new Error("A program is required.");
  }

  return {
    programId,
    title,
    difficulty: parseDifficulty(formData.get("difficulty")),
    weekNumber: parseInteger(formData.get("weekNumber"), 1),
    order: parseInteger(formData.get("order"), 0),
    brief: String(formData.get("brief") ?? "").trim(),
    objective: String(formData.get("objective") ?? "").trim(),
    acceptanceCriteria: String(formData.get("acceptanceCriteria") ?? "").trim(),
    deliverables: String(formData.get("deliverables") ?? "").trim(),
    evaluationCriteria: String(formData.get("evaluationCriteria") ?? "").trim(),
    competencyTags: parseTags(formData.get("competencyTags")),
    tutorialUrl: parseOptionalHttpUrl(formData.get("tutorialUrl"))
  };
}

export async function createMissionAction(formData: FormData) {
  const { tenant, actorUserId } = await requireMissionManager();
  const input = readMissionForm(formData);
  const mission = await createMission({
    tenantId: tenant.id,
    actorUserId,
    ...input,
    status: parseStatus(formData.get("status"))
  });

  redirect(`/missions/${mission.id}`);
}

const MAX_SPEC_BYTES = 512 * 1024;

/**
 * Create a mission from an uploaded Markdown spec (v0.20.0).
 *
 * Authoring five long-form fields in browser textareas is the slow part of adding a mission, and the
 * specs already exist as documents — the same format `prisma/seed-data/missions` uses, so those
 * files import unchanged. Only the metadata the file does not carry (program, week, order,
 * difficulty) comes from the form.
 *
 * Always created as DRAFT: the mission page is the review step, and DRAFT is invisible to
 * applicants, so a mis-parsed spec can never reach one.
 *
 * Failures redirect back with a message rather than throwing. A thrown server action renders in
 * production as a digest-only error page with nothing actionable on it.
 */
export async function importMissionSpecAction(formData: FormData) {
  const { tenant, actorUserId } = await requireMissionManager();

  const programId = String(formData.get("programId") ?? "").trim();
  if (!programId) {
    redirectWithImportError("Choose a program before importing.");
  }

  const file = formData.get("spec");
  if (!(file instanceof File) || file.size === 0) {
    redirectWithImportError("Attach a Markdown file to import.");
  }
  const spec = file as File;
  if (!/\.(md|markdown)$/i.test(spec.name)) {
    redirectWithImportError(`"${spec.name}" is not a Markdown file. Upload a .md or .markdown file.`);
  }
  if (spec.size > MAX_SPEC_BYTES) {
    redirectWithImportError("That file is larger than 512 KB. Upload the mission spec on its own.");
  }

  const parsed = parseMissionSpecMarkdown(await spec.text());
  if (!parsed.ok) {
    redirectWithImportError(parsed.errors.join(" "));
    return;
  }

  const mission = await createMission({
    tenantId: tenant.id,
    actorUserId,
    programId,
    difficulty: parseDifficulty(formData.get("difficulty")),
    weekNumber: parseInteger(formData.get("weekNumber"), 1),
    order: parseInteger(formData.get("order"), 0),
    tutorialUrl: null,
    status: "DRAFT",
    ...parsed.value
  });

  redirect(`/missions/${mission.id}?imported=1`);
}

/** `redirect` throws internally, so this never returns — typed as such to satisfy control flow. */
function redirectWithImportError(message: string): never {
  redirect(`/missions/new?importError=${encodeURIComponent(message)}`);
}

export async function updateMissionAction(formData: FormData) {
  const { tenant, actorUserId } = await requireMissionManager();
  const id = String(formData.get("missionId") ?? "");
  const existing = await getTenantMission(id, tenant.id);
  if (!existing) {
    throw new Error("Mission not found.");
  }
  assertTenantScopedAccess(existing.tenantId, tenant.id);

  await updateMission({
    id,
    tenantId: tenant.id,
    actorUserId,
    ...readMissionForm(formData)
  });

  revalidatePath("/missions");
  revalidatePath(`/missions/${id}`);
}

export async function setMissionStatusAction(formData: FormData) {
  const { tenant, actorUserId } = await requireMissionManager();
  const id = String(formData.get("missionId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as MissionStatus;
  const existing = await getTenantMission(id, tenant.id);
  if (!existing) {
    throw new Error("Mission not found.");
  }
  assertTenantScopedAccess(existing.tenantId, tenant.id);
  assertMissionStatusTransition(existing.status, toStatus);

  await setMissionStatus({ id, tenantId: tenant.id, status: toStatus, actorUserId });

  revalidatePath("/missions");
  revalidatePath(`/missions/${id}`);
}
