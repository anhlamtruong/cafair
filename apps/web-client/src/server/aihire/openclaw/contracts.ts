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

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function parseWebhookFormat(
  value: string | undefined,
): OpenClawWebhookFormat | undefined {
  if (!value) {
    return undefined;
  }

  return (OPENCLAW_WEBHOOK_FORMATS as readonly string[]).includes(value)
    ? (value as OpenClawWebhookFormat)
    : undefined;
}

export function getDefaultOpenClawNotificationTarget():
  | OpenClawNotificationTarget
  | undefined {
  const webhookUrl = firstNonEmpty(
    process.env.OPENCLAW_WEBHOOK_URL,
    process.env.OPENCLAW_DEFAULT_WEBHOOK_URL,
    process.env.OPENCLAW_DISCORD_WEBHOOK_URL,
  );
  const webhookFormat = parseWebhookFormat(
    firstNonEmpty(
      process.env.OPENCLAW_WEBHOOK_FORMAT,
      process.env.OPENCLAW_DEFAULT_WEBHOOK_FORMAT,
      webhookUrl === process.env.OPENCLAW_DISCORD_WEBHOOK_URL
        ? "discord"
        : undefined,
    ),
  );
  const channelId = firstNonEmpty(
    process.env.OPENCLAW_DEFAULT_CHANNEL_ID,
    process.env.OPENCLAW_DISCORD_CHANNEL_ID,
  );
  const conversationId = firstNonEmpty(
    process.env.OPENCLAW_DEFAULT_CONVERSATION_ID,
    process.env.OPENCLAW_DISCORD_CONVERSATION_ID,
  );
  const actorId = firstNonEmpty(process.env.OPENCLAW_DEFAULT_ACTOR_ID);

  if (!webhookUrl && !channelId && !conversationId && !actorId) {
    return undefined;
  }

  return {
    webhookUrl,
    webhookFormat,
    channelId,
    conversationId,
    actorId,
  };
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

export function resolveOpenClawNotificationTarget(
  ...targets: Array<OpenClawNotificationTarget | undefined>
): OpenClawNotificationTarget | undefined {
  return mergeOpenClawNotificationTarget(
    getDefaultOpenClawNotificationTarget(),
    ...targets,
  );
}
