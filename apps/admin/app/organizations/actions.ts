"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can, isValidTenantSlug } from "@talentos/auth";
import { createOrganization, getUserByEmail, slugify } from "@talentos/db";
import { provisionOrgAdmin } from "@/lib/keycloak-admin";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OrgActionState =
  | { ok: true; message: string; tempPassword: string | null; email: string }
  | { ok: false; error: string };

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

export async function createOrganizationAction(
  _prevState: OrgActionState | null,
  formData: FormData
): Promise<OrgActionState> {
  const { actorUserId } = await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, error: "An organization name is required." };
  }

  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!isValidTenantSlug(slug)) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, numbers and hyphens (DNS-safe), used as the tenant subdomain."
    };
  }

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const secondaryColor = String(formData.get("secondaryColor") ?? "").trim();
  if (!HEX_RE.test(primaryColor)) {
    return { ok: false, error: "Invalid primary color — must be a 6-digit hex e.g. #2563eb" };
  }
  if (!HEX_RE.test(secondaryColor)) {
    return { ok: false, error: "Invalid secondary color — must be a 6-digit hex e.g. #0f172a" };
  }

  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(adminEmail)) {
    return { ok: false, error: "A valid org-admin email is required." };
  }
  const adminName = String(formData.get("adminName") ?? "").trim() || null;

  try {
    await createOrganization({ name, slug, primaryColor, secondaryColor, adminEmail, adminName, actorUserId });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create the organization." };
  }

  revalidatePath("/organizations");

  // Auto-provision the org admin in Keycloak (identity + ORG_ADMIN realm role). The DB org already
  // exists; if this fails we keep it and report a retryable message (provisioning is idempotent).
  try {
    const result = await provisionOrgAdmin({ email: adminEmail, name: adminName });
    if (result.created && result.tempPassword) {
      return {
        ok: true,
        email: adminEmail,
        tempPassword: result.tempPassword,
        message: `Organization "${name}" created and ${adminEmail} was provisioned as ORG_ADMIN. They will be prompted to set a new password and configure 2FA on first login.`
      };
    }
    return {
      ok: true,
      email: adminEmail,
      tempPassword: null,
      message: `Organization "${name}" created. ${adminEmail} already had a Keycloak account, so the ORG_ADMIN role was granted and their existing password is unchanged.`
    };
  } catch (error) {
    return {
      ok: true,
      email: adminEmail,
      tempPassword: null,
      message: `Organization "${name}" was created, but Keycloak provisioning failed: ${
        error instanceof Error ? error.message : "unknown error"
      }. Re-submit the same details to retry, or grant the ORG_ADMIN realm role manually.`
    };
  }
}
