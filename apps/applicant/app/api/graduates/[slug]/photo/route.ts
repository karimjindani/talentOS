import { NextResponse } from "next/server";
import { getGraduatePhoto } from "@talentos/db";
import { getPresignedDownloadUrl } from "@talentos/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await getGraduatePhoto(slug);
  const key = photo?.profilePhotoFile?.storageKey;
  if (!key) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  return NextResponse.redirect(await getPresignedDownloadUrl({ key, expiresIn: 300 }));
}
