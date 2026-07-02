"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  assertProgramStatusTransition,
  assertTenantScopedAccess,
  type ProgramStatus
} from "@talentos/auth";
import {
  createProgram,
  getTenantProgram,
  setProgramStatus,
  slugify,
  updateProgram
} from "@talentos/db";
import { requireTenantAccess } from "@/lib/tenant-guard";

const PROGRAM_STATUSES: ProgramStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

// Resolve the acting reviewer + tenant, enforcing managePrograms *in the resolved tenant*
// (TenantMembership-backed — not just the realm-wide role). See lib/tenant-guard.ts (D-051).
async function requireProgramManager() {
  return requireTenantAccess("managePrograms");
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  return raw ? new Date(raw) : null;
}

export async function createProgramAction(formData: FormData) {
  const { tenant, actorUserId } = await requireProgramManager();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("A program name is required.");
  }
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugInput ? slugify(slugInput) : slugify(name);
  const description = String(formData.get("description") ?? "").trim();
  const statusInput = String(formData.get("status") ?? "DRAFT") as ProgramStatus;
  const status = PROGRAM_STATUSES.includes(statusInput) ? statusInput : "DRAFT";

  const program = await createProgram({
    tenantId: tenant.id,
    name,
    slug,
    description,
    status,
    startsAt: parseDate(formData.get("startsAt")),
    endsAt: parseDate(formData.get("endsAt")),
    actorUserId
  });

  redirect(`/programs/${program.id}`);
}

export async function updateProgramAction(formData: FormData) {
  const { tenant, actorUserId } = await requireProgramManager();

  const id = String(formData.get("programId") ?? "");
  const existing = await getTenantProgram(id, tenant.id);
  if (!existing) {
    throw new Error("Program not found.");
  }
  assertTenantScopedAccess(existing.tenantId, tenant.id);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("A program name is required.");
  }
  const slugInput = String(formData.get("slug") ?? "").trim();

  await updateProgram({
    id,
    tenantId: tenant.id,
    name,
    slug: slugInput ? slugify(slugInput) : slugify(name),
    description: String(formData.get("description") ?? "").trim(),
    startsAt: parseDate(formData.get("startsAt")),
    endsAt: parseDate(formData.get("endsAt")),
    actorUserId
  });

  revalidatePath("/programs");
  revalidatePath(`/programs/${id}`);
}

export async function setProgramStatusAction(formData: FormData) {
  const { tenant, actorUserId } = await requireProgramManager();

  const id = String(formData.get("programId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as ProgramStatus;

  const existing = await getTenantProgram(id, tenant.id);
  if (!existing) {
    throw new Error("Program not found.");
  }
  assertTenantScopedAccess(existing.tenantId, tenant.id);
  assertProgramStatusTransition(existing.status, toStatus);

  await setProgramStatus({ id, tenantId: tenant.id, status: toStatus, actorUserId });

  revalidatePath("/programs");
  revalidatePath(`/programs/${id}`);
}
