import { NextResponse } from "next/server";
import { buildOpenClawResumeReview } from "@/server/aihire/openclaw/resume-review";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const configuredSecret = process.env.OPENCLAW_DISCORD_SHARED_SECRET?.trim();

  if (!configuredSecret) {
    return true;
  }

  return req.headers.get("x-openclaw-discord-secret") === configuredSecret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized resume review request." },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json()) as {
      resumeText?: string;
      fileName?: string;
      message?: string;
    };

    if (!body.resumeText || typeof body.resumeText !== "string") {
      return NextResponse.json(
        { ok: false, error: "resumeText is required." },
        { status: 400 },
      );
    }

    const review = await buildOpenClawResumeReview({
      resumeText: body.resumeText,
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    });

    return NextResponse.json({
      ok: true,
      ...review,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to build resume review.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
