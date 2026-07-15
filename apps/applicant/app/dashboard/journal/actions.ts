"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  createJournalEntry,
  JournalEntryDateConflictError,
  listApplicantApplications,
  parseJournalEvidenceLinks,
  updateJournalEntry
} from "@talentos/db";

export type JournalFormState = {
  ok: boolean;
  error: string | null;
  existingEntryId: string | null;
};

export async function saveJournalEntryAction(
  entryId: string | null,
  _prev: JournalFormState,
  formData: FormData
): Promise<JournalFormState> {
  let createdId: string | null = null;

  try {
    const { tenant, actorUserId } = await requireTenantAccess("accessApplicantPortal");
    if (!actorUserId) {
      return { ok: false, error: "Your account is not linked to this organization.", existingEntryId: null };
    }

    const applications = await listApplicantApplications(actorUserId, tenant.id);
    const acceptedApp = applications.find((application) => application.status === "ACCEPTED");
    if (!acceptedApp) {
      return {
        ok: false,
        error: "Journal entries are available after your application is accepted.",
        existingEntryId: null
      };
    }

    const input = readJournalForm(formData);
    const entry = entryId
      ? await updateJournalEntry({ id: entryId, tenantId: tenant.id, applicantId: actorUserId, ...input })
      : await createJournalEntry({ tenantId: tenant.id, applicantId: actorUserId, ...input });

    revalidatePath("/dashboard/journal");
    revalidatePath(`/dashboard/journal/${entry.id}`);
    if (!entryId) {
      createdId = entry.id;
    }
  } catch (error) {
    if (error instanceof JournalEntryDateConflictError) {
      return { ok: false, error: error.message, existingEntryId: error.existingEntryId };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong. Try again.",
      existingEntryId: null
    };
  }

  if (createdId) {
    redirect(`/dashboard/journal/${createdId}`);
  }
  return { ok: true, error: null, existingEntryId: null };
}

function readJournalForm(formData: FormData) {
  const missionId = String(formData.get("missionId") ?? "").trim();
  if (!missionId) {
    throw new Error("Select a mission for this journal entry.");
  }

  return {
    missionId,
    entryDate: parseEntryDate(formData.get("entryDate")),
    calendarTimeZone: String(formData.get("calendarTimeZone") ?? "UTC").trim() || "UTC",
    language: readLanguage(formData),
    workedOn: String(formData.get("workedOn") ?? "").trim(),
    challenge: String(formData.get("challenge") ?? "").trim(),
    solution: String(formData.get("solution") ?? "").trim(),
    learned: String(formData.get("learned") ?? "").trim(),
    aiUsage: String(formData.get("aiUsage") ?? "").trim(),
    confidenceRating: parseInteger(formData.get("confidenceRating"), "Confidence rating"),
    timeSpentHours: parseHours(formData.get("timeSpentHours")),
    evidenceLinks: parseJournalEvidenceLinks(String(formData.get("evidenceLinks") ?? ""))
  };
}

function parseEntryDate(value: FormDataEntryValue | null): Date {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error("Entry date is required.");
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Entry date is invalid.");
  }
  return date;
}

function readLanguage(formData: FormData): string {
  const preset = String(formData.get("languagePreset") ?? "English").trim();
  if (preset === "Other") {
    return String(formData.get("customLanguage") ?? "").trim();
  }
  return preset;
}

function parseInteger(value: FormDataEntryValue | null, label: string): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is required.`);
  }
  return parsed;
}

function parseHours(value: FormDataEntryValue | null): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) {
    throw new Error("Time spent is required.");
  }
  return parsed;
}
