"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { can } from "@talentos/auth";
import {
  getTenantBySlug,
  getUserByEmail,
  updateTenantBranding,
  createStoredFile,
  markStoredFileReady
} from "@talentos/db";
import { buildObjectKey, getBucket, putObject } from "@talentos/storage";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const LOGO_MAX = 2 * 1024 * 1024; // 2 MB

export async function saveTenantBranding(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const actor = {
    platformRole: session.user.platformRole ?? null,
    orgRole: session.user.orgRole ?? null
  };
  if (!can("manageTenantSettings", actor)) {
    throw new Error("Forbidden");
  }

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error("Tenant not found");

  const name = ((formData.get("name") as string) ?? "").trim();
  const primaryColor = ((formData.get("primaryColor") as string) ?? "").trim();
  const secondaryColor = ((formData.get("secondaryColor") as string) ?? "").trim();
  const logoFile = formData.get("logo");

  if (!name) throw new Error("Name is required");
  if (!HEX_RE.test(primaryColor)) throw new Error("Invalid primary color — must be a 6-digit hex e.g. #2563eb");
  if (!HEX_RE.test(secondaryColor)) throw new Error("Invalid secondary color — must be a 6-digit hex e.g. #0f172a");

  const dbUser = session.user.email ? await getUserByEmail(session.user.email) : null;
  let logoFileId: string | undefined;

  if (logoFile instanceof File && logoFile.size > 0) {
    if (!LOGO_ALLOWED.has(logoFile.type)) {
      throw new Error("Logo must be PNG, JPEG or WebP (SVG not allowed)");
    }
    if (logoFile.size > LOGO_MAX) {
      throw new Error("Logo must be under 2 MB");
    }
    const key = buildObjectKey({ tenantId: tenant.id, category: "logo", filename: logoFile.name });
    await putObject({
      key,
      body: Buffer.from(await logoFile.arrayBuffer()),
      contentType: logoFile.type
    });
    const stored = await createStoredFile({
      tenantId: tenant.id,
      ownerUserId: dbUser?.id ?? null,
      bucket: getBucket(),
      storageKey: key,
      originalName: logoFile.name,
      contentType: logoFile.type,
      size: logoFile.size,
      category: "logo",
      actorUserId: dbUser?.id ?? null
    });
    await markStoredFileReady(stored.id, tenant.id);
    logoFileId = stored.id;
  }

  await updateTenantBranding({
    id: tenant.id,
    name,
    primaryColor,
    secondaryColor,
    ...(logoFileId !== undefined && { logoFileId }),
    actorUserId: dbUser?.id ?? null
  });

  revalidatePath("/settings");
  revalidatePath("/");
}
