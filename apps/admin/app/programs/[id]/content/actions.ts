"use server";

import { revalidatePath } from "next/cache";
import {
  createCalendarEvent,
  createProgramTask,
  createVideoResource,
  deleteCalendarEvent,
  deleteProgramTask,
  deleteVideoResource,
  updateCalendarEvent,
  updateProgramTask,
  updateVideoResource,
  LearningResourceType
} from "@talentos/db";
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

function optionalWeek(formData: FormData): number | null {
  const raw = text(formData, "weekNumber");
  if (!raw) {
    return null;
  }
  return requiredWeek(formData);
}

function requiredWeek(formData: FormData): number {
  const week = Number.parseInt(text(formData, "weekNumber"), 10);
  if (!Number.isInteger(week) || week < 1 || week > 4) {
    throw new Error("Week must be between 1 and 4.");
  }
  return week;
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

/** The externally-hosted video URL must be a well-formed http(s) link (no javascript: etc.). */
function requiredHttpUrl(formData: FormData, name: string): string {
  const raw = requiredText(formData, name, "URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL (including https://).");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Enter a valid URL (including https://).");
  }
  return url.toString();
}

function optionalHttpUrl(formData: FormData, name: string): string | null {
  return text(formData, name) ? requiredHttpUrl(formData, name) : null;
}

function resourceType(formData: FormData): LearningResourceType {
  const value = text(formData, "type");
  if (
    value !== LearningResourceType.MARKDOWN &&
    value !== LearningResourceType.YOUTUBE &&
    value !== LearningResourceType.DOCUMENT
  ) {
    throw new Error("Choose Markdown, YouTube or Document as the resource type.");
  }
  return value;
}

function optionalPositiveInteger(formData: FormData, name: string): number | null {
  const value = text(formData, name);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Duration must be a positive number of seconds.");
  }
  return parsed;
}
function contentPath(programId: string): string {
  return `/programs/${programId}/content`;
}

// ---------------------------------------------------------------------------
// Weekly learning resources
// ---------------------------------------------------------------------------

export async function createVideoResourceAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await createVideoResource({
    tenantId: tenant.id,
    programId,
    taskId: optionalText(formData, "taskId"),
    type: resourceType(formData),
    title: requiredText(formData, "title", "Title"),
    url: optionalHttpUrl(formData, "url"),
    markdownContent: optionalText(formData, "markdownContent"),
    description: optionalText(formData, "description"),
    weekNumber: optionalWeek(formData),
    order: Number.parseInt(text(formData, "order"), 10) || 0,
    durationSeconds: optionalPositiveInteger(formData, "durationSeconds"),
    fileId: optionalText(formData, "fileId"),
    actorUserId
  });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}

export async function updateVideoResourceAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await updateVideoResource({
    id: requiredText(formData, "id", "Resource"),
    tenantId: tenant.id,
    programId,
    taskId: optionalText(formData, "taskId"),
    type: resourceType(formData),
    title: requiredText(formData, "title", "Title"),
    url: optionalHttpUrl(formData, "url"),
    markdownContent: optionalText(formData, "markdownContent"),
    description: optionalText(formData, "description"),
    weekNumber: optionalWeek(formData),
    order: Number.parseInt(text(formData, "order"), 10) || 0,
    durationSeconds: optionalPositiveInteger(formData, "durationSeconds"),
    fileId: optionalText(formData, "fileId"),
    actorUserId
  });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}

export async function deleteVideoResourceAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await deleteVideoResource({ id: requiredText(formData, "id", "Resource"), tenantId: tenant.id, actorUserId });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}

// ---------------------------------------------------------------------------
// Weekly tasks
// ---------------------------------------------------------------------------

export async function createProgramTaskAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await createProgramTask({
    tenantId: tenant.id,
    programId,
    title: requiredText(formData, "title", "Title"),
    description: optionalText(formData, "description"),
    weekNumber: requiredWeek(formData),
    order: Number.parseInt(text(formData, "order"), 10) || 0,
    dueAt: optionalDate(formData, "dueAt"),
    required: formData.get("required") === "on",
    published: formData.get("published") === "on",
    isPrerequisite: formData.get("isPrerequisite") === "on",
    actorUserId
  });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}

export async function updateProgramTaskAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await updateProgramTask({
    id: requiredText(formData, "id", "Task"),
    tenantId: tenant.id,
    programId,
    title: requiredText(formData, "title", "Title"),
    description: optionalText(formData, "description"),
    weekNumber: requiredWeek(formData),
    order: Number.parseInt(text(formData, "order"), 10) || 0,
    dueAt: optionalDate(formData, "dueAt"),
    required: formData.get("required") === "on",
    published: formData.get("published") === "on",
    isPrerequisite: formData.get("isPrerequisite") === "on",
    actorUserId
  });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}

export async function deleteProgramTaskAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await deleteProgramTask({ id: requiredText(formData, "id", "Task"), tenantId: tenant.id, actorUserId });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
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
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
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
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}

export async function deleteCalendarEventAction(formData: FormData) {
  const { tenant, actorUserId } = await requireContentManager();
  const programId = requiredText(formData, "programId", "Program");

  await deleteCalendarEvent({ id: requiredText(formData, "id", "Event"), tenantId: tenant.id, actorUserId });

  revalidatePath(contentPath(programId));
  // The top-level Tasks page (v0.20.0) manages the same weekly tasks/resources, so keep it fresh too.
  revalidatePath("/tasks");
}
