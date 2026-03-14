export const OPENCLAW_WEBHOOK_FORMATS = [
  "openclaw",
  "slack",
  "whatsapp",
  "discord",
] as const;

export type OpenClawWebhookFormat = (typeof OPENCLAW_WEBHOOK_FORMATS)[number];

export interface OpenClawNotificationTarget {
  webhookUrl?: string;
  webhookFormat?: OpenClawWebhookFormat;
  channelId?: string;
  conversationId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export function mergeOpenClawNotificationTarget(
  ...targets: Array<OpenClawNotificationTarget | undefined>
): OpenClawNotificationTarget | undefined {
  const merged = targets.reduce<OpenClawNotificationTarget>(
    (acc, target) => {
      if (!target) {
        return acc;
      }

      return {
        webhookUrl: target.webhookUrl ?? acc.webhookUrl,
        webhookFormat: target.webhookFormat ?? acc.webhookFormat,
        channelId: target.channelId ?? acc.channelId,
        conversationId: target.conversationId ?? acc.conversationId,
        actorId: target.actorId ?? acc.actorId,
        metadata: {
          ...(acc.metadata ?? {}),
          ...(target.metadata ?? {}),
        },
      };
    },
    {},
  );

  if (
    !merged.webhookUrl &&
    !merged.channelId &&
    !merged.conversationId &&
    !merged.actorId &&
    (!merged.metadata || Object.keys(merged.metadata).length === 0)
  ) {
    return undefined;
  }

  return merged;
}
