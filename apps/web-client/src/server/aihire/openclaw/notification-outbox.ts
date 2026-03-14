export type OpenClawNotificationType =
  | "social_screen_batch.started"
  | "social_screen_batch.completed"
  | "social_screen_batch.failed"
  | "workflow.completed"
  | "workflow.failed";

export interface OpenClawNotificationRecord {
  id: string;
  type: OpenClawNotificationType;
  createdAtISO: string;
  text?: string;
  batchJobId?: string;
  workflowId?: string;
  channelId?: string;
  conversationId?: string;
  delivery: {
    webhookUrl?: string;
    webhookFormat?: "openclaw" | "slack" | "whatsapp" | "discord";
    delivered: boolean;
    deliveryError?: string;
  };
  payload: Record<string, unknown>;
}

export interface OpenClawNotificationFilter {
  batchJobId?: string;
  workflowId?: string;
  channelId?: string;
  conversationId?: string;
  type?: OpenClawNotificationType;
  limit?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __aihireOpenClawNotificationOutbox:
    | OpenClawNotificationRecord[]
    | undefined;
}

const outbox =
  globalThis.__aihireOpenClawNotificationOutbox ??
  (globalThis.__aihireOpenClawNotificationOutbox = []);

function makeNotificationId(): string {
  return `ocn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addOpenClawNotification(
  notification: Omit<OpenClawNotificationRecord, "id" | "createdAtISO">,
): OpenClawNotificationRecord {
  const record: OpenClawNotificationRecord = {
    ...notification,
    id: makeNotificationId(),
    createdAtISO: new Date().toISOString(),
  };

  outbox.unshift(record);

  if (outbox.length > 200) {
    outbox.length = 200;
  }

  return record;
}

export function listOpenClawNotifications(
  filter: OpenClawNotificationFilter = {},
): OpenClawNotificationRecord[] {
  const limit = filter.limit ?? 50;

  return outbox
    .filter((record) => {
      if (filter.batchJobId && record.batchJobId !== filter.batchJobId) {
        return false;
      }

      if (filter.workflowId && record.workflowId !== filter.workflowId) {
        return false;
      }

      if (filter.channelId && record.channelId !== filter.channelId) {
        return false;
      }

      if (
        filter.conversationId &&
        record.conversationId !== filter.conversationId
      ) {
        return false;
      }

      if (filter.type && record.type !== filter.type) {
        return false;
      }

      return true;
    })
    .slice(0, limit);
}
