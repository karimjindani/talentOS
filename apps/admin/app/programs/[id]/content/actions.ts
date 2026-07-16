"use server";

import { revalidatePath } from "next/cache";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@talentos/db";
import { requireTenantAccess } from "@/lib/tenant-guard";

// Program-content management (v0.16.0, D-069). Every action re-resolves the acting admin and
// enforces manageProgramContent *in the resolved tenant* (TenantMembership-backed, D-051); the db
// helpers additionally verify the program/row belongs to that tenant and write the audit entry.
async function requireContentManager() {
  return requireTenantAccess("manageProgramContent");
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function requiredText(formData: FormData, name: string, label: string): string {
  const value = text(formData, name);
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function optionalText(formData: FormData, name: string): string | null {
  return text(formData, name) || null;
}

function optionalDate(formData: FormData, name: string): Date | null {
  const raw = text(formData, name);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid date.");
  }
  return date;
}

function requiredDate(formData: FormData, name: string, label: string): Date {
  const date = optionalDate(formData, name);
  if (!date) {
    throw new Error(`${label} is required.`);
  }
  return date;
}

function contentPath(programId: string): string {
  return `/programs/${programId}/content`;
}

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

export async function createCalendarEventAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await createCalendarEvent({
    tenantId: tenant.id,
    programId,
    title: requiredText(formData, "title", "Title"),
    description: optionalText(formData, "description"),
    startsAt: requiredDate(formData, "startsAt", "Start time"),
    endsAt: optionalDate(formData, "endsAt"),
    location: optionalText(formData, "location"),
    actorUserId
  });

  revalidatePath(contentPath(programId));
}

export async function updateCalendarEventAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await updateCalendarEvent({
    id: requiredText(formData, "id", "Event"),
    tenantId: tenant.id,
    programId,
    title: requiredText(formData, "title", "Title"),
    description: optionalText(formData, "description"),
    startsAt: requiredDate(formData, "startsAt", "Start time"),
    endsAt: optionalDate(formData, "endsAt"),
    location: optionalText(formData, "location"),
    actorUserId
  });

  revalidatePath(contentPath(programId));
}

export async function deleteCalendarEventAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await deleteCalendarEvent({ id: requiredText(formData, "id", "Event"), tenantId: tenant.id, actorUserId });

  revalidatePath(contentPath(programId));
}
