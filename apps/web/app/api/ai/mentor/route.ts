import { NextResponse } from "next/server";
import { requestAIInteraction } from "@/lib/ai";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: string };
  const response = await requestAIInteraction({
    tenantId: "stub-tenant",
    purpose: "mentor",
    prompt: body.prompt ?? ""
  });

  return NextResponse.json(response);
}
