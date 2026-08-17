import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createStoredFile, markStoredFileReady, prisma } from "@talentos/db";
import { buildObjectKey, getBucket, putObject } from "@talentos/storage";
import { hasValidImageSignature } from "@/lib/image-validation";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, applications: { select: { tenantId: true }, orderBy: { createdAt: "desc" }, take: 1 } }
  });
  if (!user?.applications[0]) return NextResponse.json({ error: "No academy application was found." }, { status: 409 });
  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || !ACCEPTED_TYPES.has(photo.type) || photo.size < 1 || photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "Upload a JPG, PNG, or WebP image no larger than 2 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!hasValidImageSignature(photo.type, bytes)) return NextResponse.json({ error: "The file content does not match its image type." }, { status: 400 });
  const tenantId = user.applications[0].tenantId;
  const storageKey = buildObjectKey({ tenantId, category: "graduate-photo", filename: photo.name });
  await putObject({ key: storageKey, body: bytes, contentType: photo.type });
  const stored = await createStoredFile({ tenantId, ownerUserId: user.id, bucket: getBucket(), storageKey, originalName: photo.name, contentType: photo.type, size: photo.size, category: "graduate-photo", actorUserId: user.id });
  await markStoredFileReady(stored.id, tenantId);
  return NextResponse.json({ success: true, fileId: stored.id });
}
