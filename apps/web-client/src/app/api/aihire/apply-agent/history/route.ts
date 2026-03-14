// Path: apps/web-client/src/app/api/aihire/apply-agent/history/route.ts

import { NextResponse } from "next/server";
import {
  addApplyAgentHistoryItem,
  getApplyAgentHistory,
  updateApplyAgentHistoryItem,
  type ApplyAgentHistoryItem,
} from "@/server/aihire/apply-agent-history-store";

export {
  addApplyAgentHistoryItem,
  getApplyAgentHistory,
  updateApplyAgentHistoryItem,
};

export async function GET() {
  const items = getApplyAgentHistory();

  return NextResponse.json({
    ok: true,
    total: items.length,
    items,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ApplyAgentHistoryItem>;

    if (!body?.mode || (body.mode !== "match" && body.mode !== "run")) {
      return NextResponse.json(
        {
          ok: false,
          error: 'mode is required and must be either "match" or "run".',
        },
        { status: 400 },
      );
    }

    if (
      !body?.status ||
      !["queued", "running", "completed", "failed"].includes(body.status)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'status is required and must be one of "queued", "running", "completed", or "failed".',
        },
        { status: 400 },
      );
    }

    if (!body?.summary || typeof body.summary !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "summary is required and must be a string.",
        },
        { status: 400 },
      );
    }

    const created = addApplyAgentHistoryItem({
      mode: body.mode,
      status: body.status,
      summary: body.summary.trim(),
      targetUrl:
        typeof body.targetUrl === "string" && body.targetUrl.trim()
          ? body.targetUrl.trim()
          : undefined,
      company:
        typeof body.company === "string" && body.company.trim()
          ? body.company.trim()
          : undefined,
      roleTitle:
        typeof body.roleTitle === "string" && body.roleTitle.trim()
          ? body.roleTitle.trim()
          : undefined,
      matchedKeywordCount:
        typeof body.matchedKeywordCount === "number"
          ? body.matchedKeywordCount
          : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        item: created,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create apply-agent history item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
