import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      status: "stubbed",
      message: "Application persistence is defined in Prisma and will be wired in the next implementation pass."
    },
    { status: 202 }
  );
}
