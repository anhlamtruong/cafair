import {
  createSocialScreenBatchJob,
  getSocialScreenBatchJob,
  setSocialScreenBatchJobStatus,
} from "@/lib/aihire/socialScreenBatchStore.db";
import type { SocialScreenBatchJob } from "@/lib/aihire/socialScreenBatchTypes";
import {
  normalizeSocialScreenBatchCandidates,
  type SocialScreenBatchCandidateInput,
} from "@/lib/aihire/socialScreenBatchInput";
import { runSocialScreenBatchJob } from "@/lib/aihire/runSocialScreenBatchJob";
import {
  resolveOpenClawNotificationTarget,
  type OpenClawNotificationTarget,
} from "./contracts";
import { postOpenClawWebhook } from "./delivery";
import {
  addOpenClawNotification,
  listOpenClawNotifications,
} from "./notification-outbox";

export interface OpenClawSocialScreenBatchStartInput {
  candidates: SocialScreenBatchCandidateInput[];
  notify?: OpenClawNotificationTarget;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface OpenClawSocialScreenBatchSummary {
  batchJobId: string;
  status: SocialScreenBatchJob["status"];
  totalCandidates: number;
  completedCandidates: number;
  failedCandidates: number;
  averageFitScore: number | null;
  riskCounts: {
    low: number;
    medium: number;
    high: number;
    unknown: number;
  };
  topCandidates: Array<{
    candidateId: string;
    name: string;
    fitScore: number;
    risk: "low" | "medium" | "high";
    summary: string;
  }>;
  flaggedCandidates: Array<{
    candidateId: string;
    name: string;
    flags: string[];
    error?: string;
  }>;
  text: string;
}

export interface OpenClawSocialScreenBatchStartResult {
  ok: true;
  batchJobId: string;
  status: SocialScreenBatchJob["status"];
  totalCandidates: number;
  createdAt: string;
  statusUrl: string;
  resultsUrl: string;
  summaryUrl: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalStatus(status: SocialScreenBatchJob["status"]): boolean {
  return status === "completed" || status === "failed";
}

function makeBatchUrls(batchJobId: string) {
  return {
    statusUrl: `/api/aihire/openclaw/social-screen-batch/${encodeURIComponent(batchJobId)}`,
    resultsUrl: `/api/aihire/social-screen/batch/${encodeURIComponent(batchJobId)}/results`,
    summaryUrl: `/api/aihire/openclaw/social-screen-batch/${encodeURIComponent(batchJobId)}/summary`,
  };
}

function buildSummaryText(summary: OpenClawSocialScreenBatchSummary): string {
  const avgText =
    summary.averageFitScore === null
      ? "no scored candidates yet"
      : `average fit ${summary.averageFitScore}`;

  const topCandidate = summary.topCandidates[0];
  const topText = topCandidate
    ? ` Top candidate: ${topCandidate.name} (${topCandidate.fitScore}/${topCandidate.risk}).`
    : "";

  const reviewText = summary.flaggedCandidates.length
    ? ` ${summary.flaggedCandidates.length} candidate(s) need review.`
    : "";

  return (
    `Batch ${summary.batchJobId} is ${summary.status}. ` +
    `${summary.completedCandidates}/${summary.totalCandidates} completed, ` +
    `${summary.failedCandidates} failed, ${avgText}.` +
    topText +
    reviewText
  ).trim();
}

function buildNotificationPayload(args: {
  type:
    | "social_screen_batch.started"
    | "social_screen_batch.completed"
    | "social_screen_batch.failed";
  job: SocialScreenBatchJob;
  summary: OpenClawSocialScreenBatchSummary;
  target?: OpenClawNotificationTarget;
}) {
  return {
    type: args.type,
    batchJobId: args.job.batchJobId,
    channelId: args.target?.channelId,
    conversationId: args.target?.conversationId,
    actorId: args.target?.actorId,
    metadata: args.target?.metadata ?? {},
    text: args.summary.text,
    summary: args.summary,
    urls: makeBatchUrls(args.job.batchJobId),
  };
}

async function emitBatchNotification(args: {
  type:
    | "social_screen_batch.started"
    | "social_screen_batch.completed"
    | "social_screen_batch.failed";
  job: SocialScreenBatchJob;
  summary: OpenClawSocialScreenBatchSummary;
  target?: OpenClawNotificationTarget;
}) {
  const payload = buildNotificationPayload(args);
  const delivery = args.target?.webhookUrl
    ? await postOpenClawWebhook(args.target, payload)
    : { delivered: false as const };

  addOpenClawNotification({
    type: args.type,
    text: args.summary.text,
    batchJobId: args.job.batchJobId,
    channelId: args.target?.channelId,
    conversationId: args.target?.conversationId,
    delivery: {
      webhookUrl: args.target?.webhookUrl,
      webhookFormat: delivery.webhookFormat,
      delivered: delivery.delivered,
      deliveryError: delivery.deliveryError,
    },
    payload,
  });
}

async function waitForBatchCompletion(
  batchJobId: string,
  pollIntervalMs: number,
  timeoutMs: number,
): Promise<SocialScreenBatchJob | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await getSocialScreenBatchJob(batchJobId);

    if (!job) {
      return null;
    }

    if (isTerminalStatus(job.status)) {
      return job;
    }

    await sleep(pollIntervalMs);
  }

  return getSocialScreenBatchJob(batchJobId);
}

async function watchBatchAndNotify(args: {
  batchJobId: string;
  notify?: OpenClawNotificationTarget;
  pollIntervalMs: number;
  timeoutMs: number;
}) {
  const completedJob = await waitForBatchCompletion(
    args.batchJobId,
    args.pollIntervalMs,
    args.timeoutMs,
  );

  if (!completedJob) {
    addOpenClawNotification({
      type: "social_screen_batch.failed",
      text: `Batch ${args.batchJobId} failed before completion because the job disappeared.`,
      batchJobId: args.batchJobId,
      channelId: args.notify?.channelId,
      conversationId: args.notify?.conversationId,
      delivery: {
        webhookUrl: args.notify?.webhookUrl,
        webhookFormat: args.notify?.webhookFormat,
        delivered: false,
        deliveryError: "Batch job disappeared before completion",
      },
      payload: {
        type: "social_screen_batch.failed",
        batchJobId: args.batchJobId,
        reason: "Batch job disappeared before completion",
      },
    });
    return;
  }

  const summary = summarizeSocialScreenBatchJob(completedJob);

  if (!isTerminalStatus(completedJob.status)) {
    addOpenClawNotification({
      type: "social_screen_batch.failed",
      text: `Batch ${completedJob.batchJobId} timed out while waiting for completion.`,
      batchJobId: completedJob.batchJobId,
      channelId: args.notify?.channelId,
      conversationId: args.notify?.conversationId,
      delivery: {
        webhookUrl: args.notify?.webhookUrl,
        webhookFormat: args.notify?.webhookFormat,
        delivered: false,
        deliveryError: "Timed out waiting for batch completion",
      },
      payload: {
        type: "social_screen_batch.failed",
        batchJobId: completedJob.batchJobId,
        reason: "Timed out waiting for batch completion",
        summary,
      },
    });
    return;
  }

  await emitBatchNotification({
    type:
      completedJob.status === "failed"
        ? "social_screen_batch.failed"
        : "social_screen_batch.completed",
    job: completedJob,
    summary,
    target: args.notify,
  });
}

export function summarizeSocialScreenBatchJob(
  job: SocialScreenBatchJob,
): OpenClawSocialScreenBatchSummary {
  const completedResults = job.results
    .filter((result) => result.status === "completed" && result.result)
    .map((result) => ({
      candidateId: result.candidateId,
      name: result.name,
      fitScore: result.result!.fitScore,
      risk: result.result!.risk,
      summary: result.result!.summary,
      flags: result.result!.flags,
      error: result.error,
    }));

  const averageFitScore = completedResults.length
    ? Math.round(
        completedResults.reduce((sum, result) => sum + result.fitScore, 0) /
          completedResults.length,
      )
    : null;

  const riskCounts = completedResults.reduce(
    (acc, result) => {
      acc[result.risk] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0, unknown: 0 },
  );

  const topCandidates = [...completedResults]
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 3)
    .map(({ flags: _flags, error: _error, ...candidate }) => candidate);

  const flaggedCandidates = job.results
    .filter(
      (result) =>
        !!result.error ||
        (result.result?.flags.length ?? 0) > 0 ||
        result.result?.risk === "high",
    )
    .slice(0, 5)
    .map((result) => ({
      candidateId: result.candidateId,
      name: result.name,
      flags: result.result?.flags ?? [],
      error: result.error,
    }));

  const summary: OpenClawSocialScreenBatchSummary = {
    batchJobId: job.batchJobId,
    status: job.status,
    totalCandidates: job.totalCandidates,
    completedCandidates: job.completedCandidates,
    failedCandidates: job.failedCandidates,
    averageFitScore,
    riskCounts,
    topCandidates,
    flaggedCandidates,
    text: "",
  };

  summary.text = buildSummaryText(summary);

  return summary;
}

export async function startOpenClawSocialScreenBatch(
  input: OpenClawSocialScreenBatchStartInput,
): Promise<OpenClawSocialScreenBatchStartResult> {
  const normalizedCandidates = normalizeSocialScreenBatchCandidates(
    input.candidates,
  );

  if (!normalizedCandidates.length) {
    throw new Error("At least one candidate is required");
  }

  const notifyTarget = resolveOpenClawNotificationTarget(input.notify);
  const batchJob = await createSocialScreenBatchJob(normalizedCandidates);
  const summary = summarizeSocialScreenBatchJob(batchJob);

  await emitBatchNotification({
    type: "social_screen_batch.started",
    job: batchJob,
    summary,
    target: notifyTarget,
  });

  void runSocialScreenBatchJob(batchJob.batchJobId).catch(async (error) => {
    await setSocialScreenBatchJobStatus(batchJob.batchJobId, "failed");

    const failedJob =
      (await getSocialScreenBatchJob(batchJob.batchJobId)) ?? batchJob;

    await emitBatchNotification({
      type: "social_screen_batch.failed",
      job: failedJob,
      summary: summarizeSocialScreenBatchJob(failedJob),
      target: notifyTarget,
    });

    console.error("OpenClaw social-screen batch failed:", error);
  });

  void watchBatchAndNotify({
    batchJobId: batchJob.batchJobId,
    notify: notifyTarget,
    pollIntervalMs: input.pollIntervalMs ?? 1_500,
    timeoutMs: input.timeoutMs ?? 120_000,
  });

  return {
    ok: true,
    batchJobId: batchJob.batchJobId,
    status: batchJob.status,
    totalCandidates: batchJob.totalCandidates,
    createdAt: batchJob.createdAt,
    ...makeBatchUrls(batchJob.batchJobId),
  };
}

export async function getOpenClawSocialScreenBatchStatus(batchJobId: string) {
  const job = await getSocialScreenBatchJob(batchJobId);

  if (!job) {
    return null;
  }

  return {
    job,
    summary: summarizeSocialScreenBatchJob(job),
    notifications: listOpenClawNotifications({ batchJobId, limit: 20 }),
    ...makeBatchUrls(batchJobId),
  };
}

export async function getOpenClawSocialScreenBatchSummary(batchJobId: string) {
  const job = await getSocialScreenBatchJob(batchJobId);

  if (!job) {
    return null;
  }

  return {
    batchJobId,
    summary: summarizeSocialScreenBatchJob(job),
    notifications: listOpenClawNotifications({ batchJobId, limit: 20 }),
    candidates: job.candidates,
    results: job.results,
    ...makeBatchUrls(batchJobId),
  };
}
