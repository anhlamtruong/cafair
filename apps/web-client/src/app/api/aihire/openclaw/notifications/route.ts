import { NextResponse } from "next/server";
import {
  listOpenClawNotifications,
  type OpenClawNotificationType,
} from "@/server/aihire/openclaw/notification-outbox";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");

  const notifications = listOpenClawNotifications({
    batchJobId: searchParams.get("batchJobId") ?? undefined,
    workflowId: searchParams.get("workflowId") ?? undefined,
    channelId: searchParams.get("channelId") ?? undefined,
    conversationId: searchParams.get("conversationId") ?? undefined,
    type: (searchParams.get("type") as OpenClawNotificationType | null) ?? undefined,
    limit: limitParam ? Number.parseInt(limitParam, 10) : undefined,
  });

  return NextResponse.json({
    ok: true,
    count: notifications.length,
    notifications,
  });
}
