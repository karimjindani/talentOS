"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { updatePreferredJournalLanguage } from "@talentos/db";

export type LanguagePreferenceState = {
  ok: boolean;
  error: string | null;
};

export async function updateLanguagePreferenceAction(
  _prev: LanguagePreferenceState,
  formData: FormData
): Promise<LanguagePreferenceState> {
  try {
    const { actorUserId } = await requireTenantAccess("accessApplicantPortal");
    if (!actorUserId) {
      return { ok: false, error: "Your account is not linked to this organization." };
    }

    const preset = String(formData.get("languagePreset") ?? "English").trim();
    const language =
      preset === "Other" ? String(formData.get("customLanguage") ?? "").trim() : preset;

    await updatePreferredJournalLanguage(actorUserId, language);
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard/journal/new");
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}
