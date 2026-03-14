import { NextResponse } from "next/server";
import { getOpenClawSocialScreenBatchSummary } from "@/server/aihire/openclaw/social-screen-batch-notifier";

type RouteContext = {
  params: Promise<{
    batchJobId: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { batchJobId } = await context.params;
    const result = await getOpenClawSocialScreenBatchSummary(batchJobId);

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error: "Batch job not found",
          batchJobId,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch OpenClaw batch summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
