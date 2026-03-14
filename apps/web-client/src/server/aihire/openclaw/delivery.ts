import type { OpenClawNotificationTarget } from "./contracts";

export interface OpenClawDeliveryResult {
  delivered: boolean;
  webhookFormat?: "openclaw" | "slack" | "whatsapp" | "discord";
  deliveryError?: string;
}

const publicAppBaseUrl = (
  process.env.OPENCLAW_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3002"
).replace(/\/$/, "");

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toAbsoluteUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (!value.startsWith("/")) {
    return undefined;
  }

  return `${publicAppBaseUrl}${value}`;
}

function humanizeNotificationType(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "AI Hire AI notification";
  }

  return value
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" • ");
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function truncate(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

async function postJsonWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<OpenClawDeliveryResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        delivered: false,
        deliveryError: `Webhook returned ${response.status}`,
      };
    }

    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      deliveryError:
        error instanceof Error ? error.message : "Unknown webhook error",
    };
  }
}

function buildSlackWebhookPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const summary = asRecord(payload.summary);
  const result = asRecord(payload.result);
  const urls = asRecord(payload.urls);
  const text =
    typeof payload.text === "string"
      ? payload.text
      : humanizeNotificationType(payload.type);

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: truncate(humanizeNotificationType(payload.type), 150),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text,
      },
    },
  ];

  if (summary) {
    const fields: Array<{ type: "mrkdwn"; text: string }> = [];

    if (typeof summary.status === "string") {
      fields.push({ type: "mrkdwn", text: `*Status*\n${summary.status}` });
    }
    if (typeof summary.totalCandidates === "number") {
      fields.push({
        type: "mrkdwn",
        text: `*Candidates*\n${summary.completedCandidates ?? 0}/${summary.totalCandidates}`,
      });
    }
    if (typeof summary.failedCandidates === "number") {
      fields.push({
        type: "mrkdwn",
        text: `*Failed*\n${summary.failedCandidates}`,
      });
    }
    if (typeof summary.averageFitScore === "number") {
      fields.push({
        type: "mrkdwn",
        text: `*Average Fit*\n${summary.averageFitScore}`,
      });
    }

    const riskCounts = asRecord(summary.riskCounts);
    if (riskCounts) {
      const riskText = ["low", "medium", "high", "unknown"]
        .filter((key) => typeof riskCounts[key] === "number")
        .map((key) => `${key}:${riskCounts[key]}`)
        .join(" ");

      if (riskText) {
        fields.push({
          type: "mrkdwn",
          text: `*Risk Counts*\n${riskText}`,
        });
      }
    }

    if (fields.length > 0) {
      blocks.push({
        type: "section",
        fields: fields.slice(0, 10),
      });
    }

    const topCandidates = Array.isArray(summary.topCandidates)
      ? summary.topCandidates
      : [];
    const topCandidateLines = topCandidates
      .slice(0, 3)
      .map((candidate) => asRecord(candidate))
      .filter(Boolean)
      .map((candidate) => {
        const name =
          typeof candidate.name === "string" ? candidate.name : "Unknown";
        const fitScore =
          typeof candidate.fitScore === "number" ? candidate.fitScore : null;
        const risk =
          typeof candidate.risk === "string" ? candidate.risk : "unknown";
        const summaryText =
          typeof candidate.summary === "string"
            ? ` - ${truncate(candidate.summary, 90)}`
            : "";

        return `• *${name}*${fitScore === null ? "" : ` (${fitScore}/${risk})`}${summaryText}`;
      });

    if (topCandidateLines.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top candidates*\n${topCandidateLines.join("\n")}`,
        },
      });
    }
  }

  if (result) {
    const fields: Array<{ type: "mrkdwn"; text: string }> = [];

    if (typeof result.completedSteps === "number") {
      fields.push({
        type: "mrkdwn",
        text: `*Completed Steps*\n${result.completedSteps}`,
      });
    }
    if (typeof result.failedSteps === "number") {
      fields.push({
        type: "mrkdwn",
        text: `*Failed Steps*\n${result.failedSteps}`,
      });
    }
    if (typeof result.workflowId === "string") {
      fields.push({
        type: "mrkdwn",
        text: `*Workflow ID*\n${result.workflowId}`,
      });
    }

    if (fields.length > 0) {
      blocks.push({
        type: "section",
        fields,
      });
    }

    const steps = Array.isArray(result.steps) ? result.steps : [];
    const stepLines = steps
      .slice(0, 4)
      .map((step) => asRecord(step))
      .filter(Boolean)
      .map((step) => {
        const stepId = typeof step.stepId === "string" ? step.stepId : "step";
        const skill = typeof step.skill === "string" ? step.skill : "unknown";
        const status = typeof step.status === "string" ? step.status : "unknown";
        return `• \`${stepId}\` -> \`${skill}\` (${status})`;
      });

    if (stepLines.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Workflow steps*\n${stepLines.join("\n")}`,
        },
      });
    }
  }

  const linkLines = Object.entries(urls ?? {})
    .map(([key, value]) => {
      const absoluteUrl = toAbsoluteUrl(value);
      if (!absoluteUrl) {
        return null;
      }

      return `• <${absoluteUrl}|${key}>`;
    })
    .filter((value): value is string => !!value);

  if (linkLines.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Links*\n${linkLines.join("\n")}`,
      },
    });
  }

  const metadata = asRecord(payload.metadata);
  const tags = metadata ? asStringList(metadata.tags).slice(0, 6) : [];
  if (tags.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `tags: ${tags.join(", ")}`,
        },
      ],
    });
  }

  return {
    text,
    blocks,
  };
}

function buildWhatsAppWebhookPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const summary = asRecord(payload.summary);
  const result = asRecord(payload.result);
  const urls = asRecord(payload.urls);
  const lines: string[] = [];

  lines.push(humanizeNotificationType(payload.type));

  if (typeof payload.text === "string" && payload.text.length > 0) {
    lines.push(payload.text);
  }

  if (summary) {
    const details: string[] = [];
    if (typeof summary.status === "string") {
      details.push(`status=${summary.status}`);
    }
    if (typeof summary.totalCandidates === "number") {
      details.push(
        `candidates=${summary.completedCandidates ?? 0}/${summary.totalCandidates}`,
      );
    }
    if (typeof summary.failedCandidates === "number") {
      details.push(`failed=${summary.failedCandidates}`);
    }
    if (typeof summary.averageFitScore === "number") {
      details.push(`avgFit=${summary.averageFitScore}`);
    }
    if (details.length > 0) {
      lines.push(details.join(" | "));
    }

    const topCandidates = Array.isArray(summary.topCandidates)
      ? summary.topCandidates
      : [];
    const topLine = topCandidates
      .slice(0, 2)
      .map((candidate) => asRecord(candidate))
      .filter(Boolean)
      .map((candidate) => {
        const name =
          typeof candidate.name === "string" ? candidate.name : "Unknown";
        const fitScore =
          typeof candidate.fitScore === "number" ? candidate.fitScore : null;
        const risk =
          typeof candidate.risk === "string" ? candidate.risk : "unknown";
        return `${name}${fitScore === null ? "" : ` (${fitScore}/${risk})`}`;
      })
      .join(", ");

    if (topLine) {
      lines.push(`Top: ${topLine}`);
    }
  }

  if (result) {
    const details: string[] = [];
    if (typeof result.workflowId === "string") {
      details.push(`workflow=${result.workflowId}`);
    }
    if (typeof result.completedSteps === "number") {
      details.push(`completed=${result.completedSteps}`);
    }
    if (typeof result.failedSteps === "number") {
      details.push(`failed=${result.failedSteps}`);
    }
    if (details.length > 0) {
      lines.push(details.join(" | "));
    }
  }

  const linkLines = Object.entries(urls ?? {})
    .map(([key, value]) => {
      const absoluteUrl = toAbsoluteUrl(value);
      return absoluteUrl ? `${key}: ${absoluteUrl}` : null;
    })
    .filter((value): value is string => !!value);

  if (linkLines.length > 0) {
    lines.push(...linkLines);
  }

  return {
    text: lines.join("\n\n"),
  };
}

function buildDiscordWebhookPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const summary = asRecord(payload.summary);
  const result = asRecord(payload.result);
  const urls = asRecord(payload.urls);
  const content =
    typeof payload.text === "string"
      ? payload.text
      : humanizeNotificationType(payload.type);

  const fields: Array<Record<string, unknown>> = [];

  if (summary) {
    if (typeof summary.status === "string") {
      fields.push({ name: "Status", value: summary.status, inline: true });
    }
    if (typeof summary.totalCandidates === "number") {
      fields.push({
        name: "Candidates",
        value: `${summary.completedCandidates ?? 0}/${summary.totalCandidates}`,
        inline: true,
      });
    }
    if (typeof summary.failedCandidates === "number") {
      fields.push({
        name: "Failed",
        value: String(summary.failedCandidates),
        inline: true,
      });
    }
    if (typeof summary.averageFitScore === "number") {
      fields.push({
        name: "Average Fit",
        value: String(summary.averageFitScore),
        inline: true,
      });
    }

    const topCandidates = Array.isArray(summary.topCandidates)
      ? summary.topCandidates
      : [];
    const topText = topCandidates
      .slice(0, 3)
      .map((candidate) => asRecord(candidate))
      .filter(Boolean)
      .map((candidate) => {
        const name =
          typeof candidate.name === "string" ? candidate.name : "Unknown";
        const fitScore =
          typeof candidate.fitScore === "number" ? candidate.fitScore : null;
        const risk =
          typeof candidate.risk === "string" ? candidate.risk : "unknown";
        return `${name}${fitScore === null ? "" : ` (${fitScore}/${risk})`}`;
      })
      .join("\n");

    if (topText) {
      fields.push({
        name: "Top Candidates",
        value: topText,
        inline: false,
      });
    }
  }

  if (result) {
    if (typeof result.workflowId === "string") {
      fields.push({
        name: "Workflow ID",
        value: result.workflowId,
        inline: true,
      });
    }
    if (typeof result.completedSteps === "number") {
      fields.push({
        name: "Completed Steps",
        value: String(result.completedSteps),
        inline: true,
      });
    }
    if (typeof result.failedSteps === "number") {
      fields.push({
        name: "Failed Steps",
        value: String(result.failedSteps),
        inline: true,
      });
    }
  }

  const linkLines = Object.entries(urls ?? {})
    .map(([key, value]) => {
      const absoluteUrl = toAbsoluteUrl(value);
      return absoluteUrl ? `[${key}](${absoluteUrl})` : null;
    })
    .filter((value): value is string => !!value);

  const description = [
    content,
    linkLines.length > 0 ? `Links: ${linkLines.join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    content,
    embeds: [
      {
        title: truncate(humanizeNotificationType(payload.type), 256),
        description: truncate(description, 4000),
        fields: fields.slice(0, 10),
      },
    ],
  };
}

export async function postOpenClawWebhook(
  target: Pick<OpenClawNotificationTarget, "webhookUrl" | "webhookFormat">,
  payload: Record<string, unknown>,
): Promise<OpenClawDeliveryResult> {
  if (!target.webhookUrl) {
    return { delivered: false, webhookFormat: target.webhookFormat };
  }

  const webhookFormat = target.webhookFormat ?? "openclaw";
  const body =
    webhookFormat === "slack"
      ? buildSlackWebhookPayload(payload)
      : webhookFormat === "whatsapp"
        ? buildWhatsAppWebhookPayload(payload)
        : webhookFormat === "discord"
          ? buildDiscordWebhookPayload(payload)
        : payload;
  const delivery = await postJsonWebhook(target.webhookUrl, body);

  return {
    ...delivery,
    webhookFormat,
  };
}
