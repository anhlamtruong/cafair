#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import {
  AttachmentBuilder,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import {
  loadRepoEnv,
} from "./openclaw-env.mjs";

const execFileAsync = promisify(execFile);
const { repoRoot } = loadRepoEnv(import.meta.url);
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const token = process.env.DISCORD_BOT_TOKEN || process.env["discord-bot-token"];
const allowedChannelIds = new Set(
  (process.env.DISCORD_ALLOWED_CHANNEL_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const allowedGuildIds = new Set(
  (process.env.DISCORD_ALLOWED_GUILD_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const proactiveChannelIds = new Set(
  (process.env.OPENCLAW_DISCORD_PROACTIVE_CHANNEL_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const allowDms = (process.env.DISCORD_ALLOW_DMS || "true") !== "false";
const replyOnlyOnMention =
  (process.env.DISCORD_REPLY_ONLY_ON_MENTION || "false") === "true";
const proactiveEnabled =
  (process.env.OPENCLAW_DISCORD_PROACTIVE_ENABLED || "false") === "true";
const proactiveIdleMinutes = Number(
  process.env.OPENCLAW_DISCORD_PROACTIVE_IDLE_MINUTES || 180,
);
const proactiveMinIntervalMinutes = Number(
  process.env.OPENCLAW_DISCORD_PROACTIVE_MIN_INTERVAL_MINUTES || 360,
);
const proactiveMaxPerDay = Number(
  process.env.OPENCLAW_DISCORD_PROACTIVE_MAX_PER_DAY || 3,
);
const proactivePollMinutes = Number(
  process.env.OPENCLAW_DISCORD_PROACTIVE_POLL_MINUTES || 10,
);
const maxContextMessages = Number(
  process.env.OPENCLAW_DISCORD_MAX_CONTEXT_MESSAGES || 8,
);
const appBaseUrl =
  process.env.AIHIRE_BASE_URL ||
  process.env.OPENCLAW_PUBLIC_BASE_URL ||
  "http://localhost:3002";
const contextTimeoutMs = Number(
  process.env.OPENCLAW_DISCORD_CONTEXT_TIMEOUT_MS || 8000,
);
const resumeReviewTimeoutMs = Number(
  process.env.OPENCLAW_DISCORD_RESUME_REVIEW_TIMEOUT_MS || 25000,
);
const maxResumeContextChars = Number(
  process.env.OPENCLAW_DISCORD_MAX_RESUME_CONTEXT_CHARS || 12000,
);
const discordSharedSecret = process.env.OPENCLAW_DISCORD_SHARED_SECRET;
const agentName = process.env.OPENCLAW_AGENT || "main";
const agentThinking = process.env.OPENCLAW_DISCORD_THINKING || "low";
const agentTimeoutMs = Number(
  process.env.OPENCLAW_DISCORD_AGENT_TIMEOUT_MS || 120000,
);
const dryRun = process.argv.includes("--dry-run");
const onceProactive = process.argv.includes("--once-proactive");
const statePath = path.join(repoRoot, ".openclaw-discord-bot-state.json");
const persona =
  process.env.OPENCLAW_DISCORD_PERSONA ||
  "You are OpenClaw AI Hire AI Recruit on Discord. Reply in friendly, supportive, lightly teen-coded English that feels cute and human without getting cringe. Be warm, clear, and encouraging. You can chat about general life, coding, studying, shipping, careers, and random small-talk. When real AI Hire AI workspace context is provided below, use it confidently and accurately for recruiter, candidate, application, job, and social-screen questions. If the message is about recruiting, candidates, hiring, applying, or AI Hire AI workflows, use the AI Hire AI OpenClaw skills when that would actually help. If it is off-topic, still respond normally and kindly. Keep replies concise, relevant, and real.";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function usage() {
  log("Usage:");
  log("  node apps/web-client/scripts/openclaw-discord-bot.mjs");
  log("  node apps/web-client/scripts/openclaw-discord-bot.mjs --dry-run");
  log("  node apps/web-client/scripts/openclaw-discord-bot.mjs --once-proactive");
  log("");
  log("Required env:");
  log("  DISCORD_BOT_TOKEN");
  log("");
  log("Optional env:");
  log("  DISCORD_ALLOWED_CHANNEL_IDS=123,456");
  log("  DISCORD_ALLOWED_GUILD_IDS=123,456");
  log("  DISCORD_ALLOW_DMS=true");
  log("  DISCORD_REPLY_ONLY_ON_MENTION=false");
  log("  OPENCLAW_AGENT=main");
  log("  OPENCLAW_DISCORD_PROACTIVE_ENABLED=false");
}

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      channels: parsed?.channels ?? {},
      resumeContexts: parsed?.resumeContexts ?? {},
    };
  } catch {
    return { channels: {}, resumeContexts: {} };
  }
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function getChannelState(state, channelId) {
  if (!state.channels[channelId]) {
    state.channels[channelId] = {
      lastHumanAtISO: null,
      lastProactiveAtISO: null,
      lastDailyResetISO: null,
      proactiveCountToday: 0,
    };
  }

  return state.channels[channelId];
}

function getResumeContext(state, channelId) {
  if (!state.resumeContexts) {
    state.resumeContexts = {};
  }

  return state.resumeContexts[channelId] ?? null;
}

function setResumeContext(state, channelId, value) {
  if (!state.resumeContexts) {
    state.resumeContexts = {};
  }

  state.resumeContexts[channelId] = value;
  writeState(state);
}

function clearResumeContext(state, channelId) {
  if (!state.resumeContexts) {
    state.resumeContexts = {};
  }

  delete state.resumeContexts[channelId];
  writeState(state);
}

function touchHumanActivity(state, channelId, createdTimestamp) {
  const channelState = getChannelState(state, channelId);
  channelState.lastHumanAtISO = new Date(createdTimestamp).toISOString();
  writeState(state);
}

function resetDailyCounterIfNeeded(channelState, now) {
  const today = now.toISOString().slice(0, 10);
  const lastResetDay = channelState.lastDailyResetISO?.slice(0, 10);

  if (today !== lastResetDay) {
    channelState.lastDailyResetISO = now.toISOString();
    channelState.proactiveCountToday = 0;
  }
}

function stripMention(text, clientUserId) {
  return text.replace(new RegExp(`<@!?${clientUserId}>`, "g"), "").trim();
}

function truncate(text, max = 1800) {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}...`;
}

function truncateForPrompt(text, max = maxResumeContextChars) {
  if (!text || text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}...`;
}

function splitForDiscord(text, max = 1800) {
  if (text.length <= max) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > max) {
    const slice = remaining.slice(0, max);
    const breakIndex = Math.max(
      slice.lastIndexOf("\n\n"),
      slice.lastIndexOf("\n"),
      slice.lastIndexOf(". "),
      slice.lastIndexOf(" "),
    );
    const safeIndex = breakIndex > 200 ? breakIndex : max;
    chunks.push(remaining.slice(0, safeIndex).trim());
    remaining = remaining.slice(safeIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

async function postLocalJson(apiPath, args, timeoutMs = contextTimeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${appBaseUrl.replace(/\/$/, "")}${apiPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(discordSharedSecret
            ? { "x-openclaw-discord-secret": discordSharedSecret }
            : {}),
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      },
    );

    const parsed = await response.json().catch(() => null);
    if (!response.ok || !parsed?.ok) {
      throw new Error(parsed?.error || `HTTP ${response.status}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWorkspaceContext(args) {
  return postLocalJson("/api/aihire/openclaw/discord-context", args);
}

async function fetchResumeReview(args) {
  return postLocalJson(
    "/api/aihire/openclaw/resume-review",
    args,
    resumeReviewTimeoutMs,
  );
}

function findPdfAttachment(message) {
  return [...message.attachments.values()].find((attachment) => {
    const name = attachment.name?.toLowerCase() || "";
    const contentType = attachment.contentType?.toLowerCase() || "";

    return name.endsWith(".pdf") || contentType === "application/pdf";
  });
}

async function extractPdfTextFromAttachment(attachment) {
  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF attachment (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const parser = new PDFParse({ data: Buffer.from(arrayBuffer) });

  try {
    const result = await parser.getText();
    const text = typeof result?.text === "string" ? result.text : "";

    if (!text.trim()) {
      throw new Error("PDF text extraction returned empty text.");
    }

    return text.trim();
  } finally {
    await parser.destroy?.();
  }
}

async function fetchRecentTranscript(messageOrChannel) {
  if (!messageOrChannel?.messages?.fetch) {
    return "";
  }

  const collection = await messageOrChannel.messages.fetch({
    limit: Math.max(2, maxContextMessages),
  });
  const entries = [...collection.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((entry) => {
      const author = entry.author?.bot
        ? `Bot:${entry.author.username}`
        : `Human:${entry.member?.displayName || entry.author?.username || "Unknown"}`;
      const content = entry.content?.trim() || "[non-text message]";

      return `${author}: ${content}`;
    });

  return entries.join("\n");
}

async function runOpenClawAgent(prompt) {
  const { stdout, stderr } = await execFileAsync(
    "npx",
    [
      "openclaw@latest",
      "agent",
      "--agent",
      agentName,
      "--message",
      prompt,
      "--thinking",
      agentThinking,
      "--json",
    ],
    {
      cwd: repoRoot,
      env: process.env,
      timeout: agentTimeoutMs,
      maxBuffer: 1024 * 1024 * 12,
    },
  );

  const text = stdout.trim();
  if (!text) {
    throw new Error(stderr.trim() || "OpenClaw agent returned no output");
  }

  const parsed = JSON.parse(text);
  const payloadText = parsed?.result?.payloads
    ?.map((payload) => payload?.text)
    .filter(Boolean)
    .join("\n\n");

  if (!payloadText) {
    throw new Error("OpenClaw agent returned JSON without a text payload");
  }

  return payloadText;
}

function isChannelAllowed(message, clientUserId) {
  if (message.author?.bot) {
    return false;
  }

  if (message.channel?.type === ChannelType.DM) {
    return allowDms;
  }

  if (allowedGuildIds.size > 0 && !allowedGuildIds.has(message.guildId || "")) {
    return false;
  }

  if (allowedChannelIds.size > 0 && !allowedChannelIds.has(message.channelId)) {
    return false;
  }

  if (replyOnlyOnMention && !message.mentions?.users?.has(clientUserId)) {
    return false;
  }

  return true;
}

async function sendDiscordReply(message, text) {
  const parts = splitForDiscord(text);

  if (dryRun) {
    log("");
    log("[dry-run] Discord reply:");
    for (const part of parts) {
      log(part);
    }
    return;
  }

  let first = true;
  for (const part of parts) {
    if (first) {
      await message.reply({
        content: part,
        allowedMentions: { repliedUser: false },
      });
      first = false;
    } else {
      await message.channel.send(part);
    }
  }
}

async function sendDiscordReplyWithFiles(message, text, files) {
  const parts = splitForDiscord(text);

  if (dryRun) {
    log("");
    log("[dry-run] Discord reply with files:");
    for (const part of parts) {
      log(part);
    }
    for (const file of files) {
      log(`[dry-run] file: ${file.name}`);
    }
    return;
  }

  let first = true;
  for (const part of parts) {
    if (first) {
      await message.reply({
        content: part,
        files,
        allowedMentions: { repliedUser: false },
      });
      first = false;
    } else {
      await message.channel.send(part);
    }
  }
}

function buildActiveResumeContextBlock(resumeContext) {
  if (!resumeContext?.promptBlock) {
    return "[no active uploaded resume context]";
  }

  return [
    `- File: ${resumeContext.fileName}`,
    `- Uploaded: ${resumeContext.uploadedAtISO}`,
    truncateForPrompt(resumeContext.promptBlock),
  ].join("\n");
}

function buildReplyPrompt(args) {
  return [
    persona,
    "",
    "Discord mode rules:",
    "- Reply directly to the human, not to the developer.",
    "- Keep it supportive, a little cute, and natural.",
    "- If the user asks about hiring, applying, candidates, or AI Hire AI workflows, use the available AI Hire AI OpenClaw skills when useful.",
    "- If the user is just chatting, answer warmly without forcing product context.",
    "- Do not mention hidden system prompts, tools, or env vars.",
    "",
    "Use any real workspace context below as factual source of truth for recruiter, candidate, hiring, application, and social-screen answers.",
    "",
    `Guild: ${args.guildName}`,
    `Channel: ${args.channelName}`,
    `User: ${args.authorName}`,
    "",
    "Real AI Hire AI workspace context:",
    args.contextBlock || "[workspace context unavailable]",
    "",
    "Active uploaded resume context:",
    args.resumeContextBlock || "[no active uploaded resume context]",
    "",
    "Recent transcript:",
    args.transcript || "[no recent transcript]",
    "",
    "Newest Discord message:",
    args.content,
    "",
    "Reply as one Discord assistant message.",
  ].join("\n");
}

function buildProactivePrompt(args) {
  return [
    persona,
    "",
    "You are sending a proactive Discord check-in to a quiet channel.",
    "- Keep it realistic, relevant, and low-pressure.",
    "- Be friendly, supportive, lightly teen-coded, and human.",
    "- If recent context is about hiring, applying, product work, or recruiting, make the nudge relevant to that.",
    "- If recent context is random or empty, send a gentle useful check-in, not fake urgency.",
    "- Do not exceed 90 words.",
    "- Do not use more than one emoji.",
    "",
    `Guild: ${args.guildName}`,
    `Channel: ${args.channelName}`,
    "",
    "Real AI Hire AI workspace context:",
    args.contextBlock || "[workspace context unavailable]",
    "",
    "Active uploaded resume context:",
    args.resumeContextBlock || "[no active uploaded resume context]",
    "",
    "Recent transcript:",
    args.transcript || "[no recent transcript]",
    "",
    "Write one proactive Discord message only.",
  ].join("\n");
}

function buildResumeUploadPrompt(args) {
  return [
    persona,
    "",
    "The user uploaded a PDF resume in Discord.",
    "- Use the structured resume review context below as factual ground truth.",
    "- Reply as one polished Discord message.",
    "- Keep it warm, sharp, and recruiter-useful.",
    "- Include three short sections: recruiter take, candidate take, best-fit roles.",
    "- Mention that attached files include an annotated HTML review and a markdown report.",
    "- Do not invent facts not present in the review context.",
    "",
    `Guild: ${args.guildName}`,
    `Channel: ${args.channelName}`,
    `User: ${args.authorName}`,
    `Original message: ${args.content || "[no extra message]"}`,
    "",
    "Resume review context:",
    args.reviewPromptBlock,
    "",
    "Write the Discord reply only.",
  ].join("\n");
}

async function handleResumeUpload(message, state, content) {
  const attachment = findPdfAttachment(message);
  if (!attachment) {
    return false;
  }

  await message.channel.sendTyping?.();

  const resumeText = await extractPdfTextFromAttachment(attachment);
  const review = await fetchResumeReview({
    resumeText,
    fileName: attachment.name,
    message: content,
  });

  const reviewPromptBlock = truncateForPrompt(review.promptBlock);

  setResumeContext(state, message.channelId, {
    fileName: attachment.name || `${review.fileBaseName}.pdf`,
    uploadedAtISO: new Date().toISOString(),
    promptBlock: reviewPromptBlock,
  });

  const replyPrompt = buildResumeUploadPrompt({
    guildName: message.guild?.name || "DM",
    channelName:
      "name" in message.channel && typeof message.channel.name === "string"
        ? message.channel.name
        : "direct-message",
    authorName: message.member?.displayName || message.author.username || "Unknown",
    content,
    reviewPromptBlock,
  });

  let replyText = review.discordSummary;
  try {
    replyText = truncate(await runOpenClawAgent(replyPrompt), 1800);
  } catch (error) {
    log(
      `Resume upload polish pass fell back to deterministic summary: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const files = [
    new AttachmentBuilder(Buffer.from(review.markdownReport, "utf8"), {
      name: `${review.fileBaseName}-review.md`,
    }),
    new AttachmentBuilder(Buffer.from(review.htmlReport, "utf8"), {
      name: `${review.fileBaseName}-annotated.html`,
    }),
  ];

  await sendDiscordReplyWithFiles(message, replyText, files);
  return true;
}

async function maybeRunProactiveCycle(client, state) {
  if (!proactiveEnabled || proactiveChannelIds.size === 0) {
    return;
  }

  const now = new Date();

  for (const channelId of proactiveChannelIds) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.() || !channel?.messages?.fetch) {
      continue;
    }

    const channelState = getChannelState(state, channelId);
    resetDailyCounterIfNeeded(channelState, now);

    if (channelState.proactiveCountToday >= proactiveMaxPerDay) {
      continue;
    }

    const recentMessages = await channel.messages.fetch({ limit: 12 });
    const humans = [...recentMessages.values()]
      .filter((entry) => !entry.author?.bot)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    const lastHuman = humans[0];

    if (!lastHuman) {
      continue;
    }

    const idleMs = now.getTime() - lastHuman.createdTimestamp;
    if (idleMs < proactiveIdleMinutes * 60_000) {
      continue;
    }

    const lastProactiveAt = channelState.lastProactiveAtISO
      ? new Date(channelState.lastProactiveAtISO).getTime()
      : 0;
    if (
      lastProactiveAt &&
      now.getTime() - lastProactiveAt < proactiveMinIntervalMinutes * 60_000
    ) {
      continue;
    }

    const transcript = [...recentMessages.values()]
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((entry) => {
        const author = entry.author?.bot
          ? `Bot:${entry.author.username}`
          : `Human:${entry.member?.displayName || entry.author?.username || "Unknown"}`;
        const content = entry.content?.trim() || "[non-text message]";

        return `${author}: ${content}`;
      })
      .join("\n");

    let contextBlock = "";
    try {
      const workspaceContext = await fetchWorkspaceContext({
        message: "",
        transcript,
        guildId: channel.guild?.id,
        channelId,
      });
      contextBlock = workspaceContext?.contextBlock || "";
    } catch (error) {
      log(
        `Discord workspace context unavailable for proactive nudge in ${channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const prompt = buildProactivePrompt({
      guildName: channel.guild?.name || "DM",
      channelName:
        "name" in channel && typeof channel.name === "string"
          ? channel.name
          : "direct-message",
      contextBlock,
      resumeContextBlock: buildActiveResumeContextBlock(
        getResumeContext(state, channelId),
      ),
      transcript,
    });

    try {
      const reply = truncate(await runOpenClawAgent(prompt));

      if (dryRun) {
        log("");
        log(`[dry-run] proactive message for ${channelId}:`);
        log(reply);
      } else {
        await channel.send(reply);
      }

      channelState.lastProactiveAtISO = now.toISOString();
      channelState.proactiveCountToday += 1;
      writeState(state);
      log(`Sent proactive Discord nudge to ${channelId}.`);
    } catch (error) {
      log(
        `Failed proactive Discord nudge for ${channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("help")) {
    usage();
    return;
  }

  if (!token) {
    throw new Error(
      "Missing DISCORD_BOT_TOKEN. Add it to your local .env before running the Discord bot bridge.",
    );
  }

  const state = readState();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    log(`Discord bot ready as ${readyClient.user.tag}.`);
    log(`OpenClaw agent: ${agentName}`);
    log(
      `Allowed channels: ${
        allowedChannelIds.size > 0 ? [...allowedChannelIds].join(", ") : "all visible"
      }`,
    );
    log(
      `Proactive nudges: ${
        proactiveEnabled && proactiveChannelIds.size > 0
          ? [...proactiveChannelIds].join(", ")
          : "disabled"
      }`,
    );

    if (onceProactive) {
      await maybeRunProactiveCycle(readyClient, state);
      await readyClient.destroy();
      return;
    }

    if (proactiveEnabled && proactiveChannelIds.size > 0) {
      setInterval(
        () => void maybeRunProactiveCycle(readyClient, state),
        proactivePollMinutes * 60_000,
      );
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!client.user || !isChannelAllowed(message, client.user.id)) {
      return;
    }

    touchHumanActivity(state, message.channelId, message.createdTimestamp);

    const content = stripMention(message.content || "", client.user.id);

    if (content === "!help") {
      await sendDiscordReply(
        message,
        "hi hi, I can chat normally, use live AI Hire AI workspace context for candidates / roles / applications / social-screen status, review uploaded PDF resumes, attach annotated report files, and run the OpenClaw recruiter skills when your message is about hiring or candidates. If you want less noise, set `DISCORD_REPLY_ONLY_ON_MENTION=true` in your local env.",
      );
      return;
    }

    if (content === "!clearresume") {
      clearResumeContext(state, message.channelId);
      await sendDiscordReply(
        message,
        "cleared the active uploaded resume for this channel. If you drop a new PDF, I’ll use that one instead.",
      );
      return;
    }

    if (findPdfAttachment(message)) {
      try {
        await handleResumeUpload(message, state, content);
      } catch (error) {
        await sendDiscordReply(
          message,
          `ahh, I couldn't process that PDF cleanly: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      return;
    }

    if (!content) {
      return;
    }

    const transcript = await fetchRecentTranscript(message.channel);
    let contextBlock = "";

    try {
      const workspaceContext = await fetchWorkspaceContext({
        message: content,
        transcript,
        guildId: message.guildId,
        channelId: message.channelId,
      });
      contextBlock = workspaceContext?.contextBlock || "";
    } catch (error) {
      log(
        `Discord workspace context unavailable for ${message.channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const prompt = buildReplyPrompt({
      guildName: message.guild?.name || "DM",
      channelName:
        "name" in message.channel && typeof message.channel.name === "string"
          ? message.channel.name
          : "direct-message",
      authorName: message.member?.displayName || message.author.username || "Unknown",
      content,
      contextBlock,
      resumeContextBlock: buildActiveResumeContextBlock(
        getResumeContext(state, message.channelId),
      ),
      transcript,
    });

    try {
      const reply = truncate(await runOpenClawAgent(prompt));
      await sendDiscordReply(message, reply);
    } catch (error) {
      await sendDiscordReply(
        message,
        `ahh, I hit a Discord/OpenClaw bridge issue just now: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  await client.login(token);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : String(error);
  const output = message.includes("Used disallowed intents")
    ? "Discord rejected the bot intents. Enable `Message Content Intent` in the Discord Developer Portal for this bot, then try `npm run dev:openclaw-discord` again."
    : message;
  process.stderr.write(
    `${output}\n`,
  );
  process.exit(1);
});
