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
