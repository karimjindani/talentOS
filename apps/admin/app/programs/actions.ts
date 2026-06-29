"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  assertProgramStatusTransition,
  assertTenantScopedAccess,
  can,
  type ProgramStatus
} from "@talentos/auth";
import {
  createProgram,
  getTenantBySlug,
  getTenantProgram,
  getUserByEmail,
  setProgramStatus,
  slugify,
  updateProgram
} from "@talentos/db";
import { getTenantContext } from "@talentos/ui";

const PROGRAM_STATUSES: ProgramStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

// Resolve the acting reviewer + tenant, enforcing the managePrograms capability.
async function requireProgramManager() {
  const session = await auth();
  const canManage = can("managePrograms", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  if (!canManage) {
    redirect("/forbidden");
  }

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error(`Unknown tenant "${tenantSlug}".`);
  }

  const actor = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  return { tenant, actorUserId: actor?.id ?? null };
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
