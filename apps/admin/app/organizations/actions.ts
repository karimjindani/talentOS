"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can, isValidTenantSlug } from "@talentos/auth";
import { createOrganization, getUserByEmail, slugify } from "@talentos/db";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only the platform SUPER_ADMIN may create organizations.
async function requireSuperAdmin() {
  const session = await auth();
  const allowed = can("createOrganization", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  if (!allowed) {
    redirect("/forbidden");
  }
  const actor = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  return { actorUserId: actor?.id ?? null };
}

export async function createOrganizationAction(formData: FormData) {
  const { actorUserId } = await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("An organization name is required.");
  }

  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!isValidTenantSlug(slug)) {
    throw new Error(
      "Slug must be lowercase letters, numbers and hyphens (DNS-safe), used as the tenant subdomain."
    );
  }

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const secondaryColor = String(formData.get("secondaryColor") ?? "").trim();
  if (!HEX_RE.test(primaryColor)) {
    throw new Error("Invalid primary color — must be a 6-digit hex e.g. #2563eb");
  }
  if (!HEX_RE.test(secondaryColor)) {
    throw new Error("Invalid secondary color — must be a 6-digit hex e.g. #0f172a");
  }

  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(adminEmail)) {
    throw new Error("A valid org-admin email is required.");
  }
  const adminName = String(formData.get("adminName") ?? "").trim() || null;

  await createOrganization({
    name,
    slug,
    primaryColor,
    secondaryColor,
    adminEmail,
    adminName,
    actorUserId
  });

  revalidatePath("/organizations");
}
