import { NextResponse } from "next/server";
import { getOpenClawSocialScreenBatchStatus } from "@/server/aihire/openclaw/social-screen-batch-notifier";

type RouteContext = {
  params: Promise<{
    batchJobId: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { batchJobId } = await context.params;
    const result = await getOpenClawSocialScreenBatchStatus(batchJobId);

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
        error: "Failed to fetch OpenClaw batch status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
