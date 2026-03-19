import { NextResponse } from "next/server";
import { startOpenClawSocialScreenBatch } from "@/server/aihire/openclaw/social-screen-batch-notifier";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/aihire/openclaw/social-screen-batch",
    method: "POST",
    purpose:
      "Start a social-screen batch job with OpenClaw-style async notifications.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await startOpenClawSocialScreenBatch(body);

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to start OpenClaw social-screen batch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
