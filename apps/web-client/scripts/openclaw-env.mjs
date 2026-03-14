#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";

const WEBHOOK_FORMATS = new Set(["openclaw", "slack", "whatsapp", "discord"]);

export function resolveRepoRoot(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "../../..");
}

export function loadRepoEnv(importMetaUrl) {
  const repoRoot = resolveRepoRoot(importMetaUrl);
  const envPaths = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      loadDotEnv({ path: envPath, override: false });
    }
  }

  return { repoRoot };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function getConfiguredWebhookTarget() {
  const webhookUrl = firstNonEmpty(
    process.env.OPENCLAW_WEBHOOK_URL,
    process.env.OPENCLAW_DEFAULT_WEBHOOK_URL,
    process.env.OPENCLAW_DISCORD_WEBHOOK_URL,
  );

  const formatCandidate = firstNonEmpty(
    process.env.OPENCLAW_WEBHOOK_FORMAT,
    process.env.OPENCLAW_DEFAULT_WEBHOOK_FORMAT,
    webhookUrl === process.env.OPENCLAW_DISCORD_WEBHOOK_URL ? "discord" : undefined,
  );

  const webhookFormat = WEBHOOK_FORMATS.has(formatCandidate ?? "")
    ? formatCandidate
    : undefined;

  const channelId = firstNonEmpty(
    process.env.OPENCLAW_DEFAULT_CHANNEL_ID,
    process.env.OPENCLAW_DISCORD_CHANNEL_ID,
  );
  const conversationId = firstNonEmpty(
    process.env.OPENCLAW_DEFAULT_CONVERSATION_ID,
    process.env.OPENCLAW_DISCORD_CONVERSATION_ID,
  );

  if (!webhookUrl && !channelId && !conversationId) {
    return undefined;
  }

  return {
    webhookUrl,
    webhookFormat,
    channelId,
    conversationId,
  };
}

export function redactWebhookUrl(value) {
  if (!value) {
    return value;
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length >= 3 && segments[0] === "api" && segments[1] === "webhooks") {
      return `${url.origin}/api/webhooks/${segments[2]}/***`;
    }

    return `${url.origin}${url.pathname}`;
  } catch {
    if (value.length <= 12) {
      return "***";
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
}

