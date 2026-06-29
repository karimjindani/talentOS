import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { createStoredFile, getTenantBySlug, getUserByEmail } from "@talentos/db";
import { buildObjectKey, getBucket, getPresignedUploadUrl } from "@talentos/storage";

// Conservative allowlist for the foundation; product surfaces can narrow per category later.
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: `Unknown tenant "${tenantSlug}".` }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
    size?: number;
    category?: string;
  };
  const filename = (body.filename ?? "").trim();
  const contentType = (body.contentType ?? "").trim();
  const size = Number(body.size ?? 0);
  const category = (body.category ?? "general").trim() || "general";

  if (!filename) {
    return NextResponse.json({ error: "filename is required." }, { status: 400 });
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: `Unsupported content type "${contentType}".` }, { status: 415 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "size must be between 1 byte and 10 MB." }, { status: 413 });
  }

  const actor = session.user.email ? await getUserByEmail(session.user.email) : null;
  const storageKey = buildObjectKey({ tenantId: tenant.id, category, filename });

  const file = await createStoredFile({
    tenantId: tenant.id,
    ownerUserId: actor?.id ?? null,
    bucket: getBucket(),
    storageKey,
    originalName: filename,
    contentType,
    size,
    category,
    actorUserId: actor?.id ?? null
  });

  const uploadUrl = await getPresignedUploadUrl({ key: storageKey, contentType });

  return NextResponse.json({ fileId: file.id, uploadUrl, key: storageKey });
}
