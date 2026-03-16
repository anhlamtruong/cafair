import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  getDefaultApplyBatchCandidateProfile,
  rankApplyBatchJobs,
  type CandidateTargetProfile,
  type RankedApplyJob,
} from "./applyBatchScoring.js";
import { loadApplyBatchJobSnippet } from "./applyBatchJobSnippet.js";
import {
  fetchAndParseSimplifyJobs,
  type SimplifyGithubJobRow,
} from "./simplifyGithubJobs.js";
import {
  isAutomationSupportedProvider,
  type ApplyBatchProvider,
} from "./applyBatchProviderDetector.js";

export type ApplyBatchMode = "demo" | "deterministic" | "nova";
export type ApplyBatchRunStatus = "queued" | "running" | "completed" | "failed";
export type AppliedJobStatus =
  | "applied"
  | "safe_stopped"
  | "blocked"
  | "skipped"
  | "failed";

export type ApplyBatchRunRequest = {
  mode?: ApplyBatchMode;
  candidateId?: string;
  candidateLabel?: string;
  candidateSlug?: string;
  profile?: Partial<CandidateTargetProfile>;
  sourceUrl?: string;
  maxJobsToApply?: number;
  applyThreshold?: number;
  maxFitConcurrency?: number;
  maxApplyConcurrency?: number;
  autoSubmit?: boolean;
  allowReviewQueue?: boolean;
  visibleBrowser?: boolean;
};

export type ApplyBatchEvent = {
  type:
    | "status"
    | "job_discovered"
    | "job_scored"
    | "job_selected"
    | "apply_started"
    | "apply_step"
    | "apply_blocked"
    | "apply_done"
    | "error"
    | "done";
  eventId: string;
  timestampISO: string;
  message: string;
  phase?: string;
  data?: Record<string, unknown>;
};

export type ApplyBatchAppliedJob = {
  rowKey: string;
  company: string;
  roleTitle: string;
  location: string;
  applyUrl: string;
  provider: ApplyBatchProvider;
  fitScore: number;
  deterministicScore: number;
  semanticFitScore?: number;
  decision: "apply" | "review" | "skip";
  fitReasons: string[];
  supportedForAutomation: boolean;
  snippet?: string;
  applyStatus: AppliedJobStatus;
  statusReason: string;
  applyResult?: {
    status: string;
    executed: boolean;
    safeStopBeforeSubmit: boolean;
    message: string;
    executionReportPath?: string;
  };
  artifacts?: {
    applyRequestPath?: string;
    planPath?: string;
    executionReportPath?: string;
    providerLogsPath?: string;
  };
};

export type ApplyBatchReportJob = Omit<
  ApplyBatchAppliedJob,
  "applyStatus" | "statusReason" | "artifacts"
>;

export type ApplyBatchReport = {
  version: "1.0";
  runId: string;
  mode: ApplyBatchMode;
  candidate: {
    candidateId?: string;
    candidateLabel: string;
    candidateSlug: string;
  };
  source: {
    sourceUrl: string;
    resolvedUrl: string;
    sourceType: "markdown" | "html" | "demo";
  };
  summary: {
    discoveredCount: number;
    rankedCount: number;
    selectedCount: number;
    appliedCount: number;
    reviewCount: number;
    skippedCount: number;
    applyThreshold: number;
    maxJobsToApply: number;
    usedFallback: boolean;
  };
  selectedJobs: ApplyBatchReportJob[];
  rankedJobs: ApplyBatchReportJob[];
  appliedJobs: ApplyBatchAppliedJob[];
  errors: string[];
  createdAtISO: string;
};

export type ApplyBatchRunManifest = {
  runId: string;
  candidateId?: string;
  candidateLabel: string;
  candidateSlug: string;
  runDir: string;
  mode: ApplyBatchMode;
  sourceUrl: string;
  status: ApplyBatchRunStatus;
  startedAtISO: string;
  updatedAtISO: string;
  finishedAtISO?: string;
  config: {
    maxJobsToApply: number;
    applyThreshold: number;
    maxFitConcurrency: number;
    maxApplyConcurrency: number;
    autoSubmit: boolean;
    allowReviewQueue: boolean;
    visibleBrowser: boolean;
  };
  paths: {
    runJson: string;
    eventsJsonl: string;
    jobsRawJson: string;
    jobsRankedJson: string;
    reportJson: string;
  };
  errors: string[];
};

type DiscoverResult = {
  jobs: SimplifyGithubJobRow[];
  resolvedUrl: string;
  sourceType: "markdown" | "html" | "demo";
};

type ApplyAgentRunnerResponse = {
  ok?: boolean;
  status?: string;
  executed?: boolean;
  message?: string;
  browserOpened?: boolean;
  sessionType?: string;
  transportSummary?: string;
  actionLogs?: Array<{
    stepId?: string;
    action?: string;
    detail?: string;
    status?: string;
    selector?: string;
    value?: unknown;
    timestamp?: string;
  }>;
  executionSteps?: Array<{
    id?: string;
    action?: string;
    detail?: string;
    status?: string;
  }>;
  browserSession?: {
    steps?: Array<Record<string, unknown>>;
  };
  fill?: {
    counts?: {
      blocked?: number;
    };
  };
  browser?: {
    summary?: {
      blocked_count?: number;
      can_continue?: boolean;
      has_safe_stop?: boolean;
    };
  };
};

type ApplyAgentRunResult = {
  requestPayload: Record<string, unknown>;
  stdout: string;
  stderr: string;
  response?: ApplyAgentRunnerResponse;
  errorMessage?: string;
};

type NovaAvailability = {
  available: boolean;
  reason?: string;
};

type ApplyBatchRunnerDeps = {
  repoRoot?: string;
  baseRunDir?: string;
  now?: () => Date;
  discoverJobs?: (sourceUrl: string) => Promise<DiscoverResult>;
  snippetLoader?: (job: SimplifyGithubJobRow) => Promise<string | undefined>;
  runApplyAgent?: (input: {
    repoRoot: string;
    manifest: ApplyBatchRunManifest;
    job: ApplyBatchReportJob;
    safeStopBeforeSubmit: boolean;
  }) => Promise<ApplyAgentRunResult>;
  checkNovaAvailability?: () => Promise<NovaAvailability>;
};

const DEFAULT_SOURCE_URL =
  "https://github.com/SimplifyJobs/Summer2026-Internships";

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function cleanText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugifyCandidateLabel(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default-candidate"
  );
}

function buildRunId(candidateSlug: string, now: () => Date): string {
  return `bar_${candidateSlug}_${now()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")}`;
}

function findRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, "apps", "llm", "agents")) &&
      fs.existsSync(path.join(current, "apps", "web-client-candidate"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not resolve repo root from: ${startDir}`);
    }
    current = parent;
  }
}

function writeJsonAtomic(filePath: string, payload: unknown): void {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tempPath, filePath);
}

function toReportJob(job: RankedApplyJob): ApplyBatchReportJob {
  return {
    rowKey: job.rowKey,
    company: job.company,
    roleTitle: job.roleTitle,
    location: job.location,
    applyUrl: job.applyUrl,
    provider: job.provider,
    fitScore: job.fitScore,
    deterministicScore: job.deterministicScore,
    semanticFitScore: job.semanticFitScore,
    decision: job.decision,
    fitReasons: job.fitReasons,
    supportedForAutomation: job.supportedForAutomation,
    snippet: job.snippet,
  };
}

function toAppliedJob(
  job: ApplyBatchReportJob,
  input: {
    applyStatus: AppliedJobStatus;
    statusReason: string;
    applyResult?: ApplyBatchAppliedJob["applyResult"];
    artifacts?: ApplyBatchAppliedJob["artifacts"];
  },
): ApplyBatchAppliedJob {
  return {
    ...job,
    applyStatus: input.applyStatus,
    statusReason: input.statusReason,
    applyResult: input.applyResult,
    artifacts: input.artifacts,
  };
}

function buildManifest(
  request: ApplyBatchRunRequest,
  deps: ApplyBatchRunnerDeps,
): ApplyBatchRunManifest {
  const now = deps.now ?? (() => new Date());
  const repoRoot = deps.repoRoot ?? findRepoRoot();
  const baseRunDir =
    deps.baseRunDir ??
    path.join(repoRoot, "apps", "llm", "agents", ".runs", "apply");
  const candidateLabel = cleanText(request.candidateLabel) ?? "Default Candidate";
  const candidateSlug =
    cleanText(request.candidateSlug) ?? slugifyCandidateLabel(candidateLabel);
  const runId = buildRunId(candidateSlug, now);
  const runDir = path.join(baseRunDir, candidateSlug, runId);
  fs.mkdirSync(runDir, { recursive: true });

  return {
    runId,
    candidateId: cleanText(request.candidateId),
    candidateLabel,
    candidateSlug,
    runDir,
    mode: request.mode ?? "deterministic",
    sourceUrl: cleanText(request.sourceUrl) ?? DEFAULT_SOURCE_URL,
    status: "queued",
    startedAtISO: nowIso(now),
    updatedAtISO: nowIso(now),
    config: {
      visibleBrowser: request.visibleBrowser === true,
      maxJobsToApply: Math.max(1, request.maxJobsToApply ?? 10),
      applyThreshold: Math.max(0, request.applyThreshold ?? 70),
      maxFitConcurrency: Math.max(1, request.maxFitConcurrency ?? 5),
      maxApplyConcurrency:
        request.visibleBrowser === true
          ? 1
          : Math.max(1, request.maxApplyConcurrency ?? 1),
      autoSubmit: request.autoSubmit === true,
      allowReviewQueue: request.allowReviewQueue === true,
    },
    paths: {
      runJson: path.join(runDir, "run.json"),
      eventsJsonl: path.join(runDir, "events.jsonl"),
      jobsRawJson: path.join(runDir, "jobs_raw.json"),
      jobsRankedJson: path.join(runDir, "jobs_ranked.json"),
      reportJson: path.join(runDir, "report.json"),
    },
    errors: [],
  };
}

function writeManifest(
  manifest: ApplyBatchRunManifest,
  deps: ApplyBatchRunnerDeps,
): ApplyBatchRunManifest {
  const next = {
    ...manifest,
    updatedAtISO: nowIso(deps.now ?? (() => new Date())),
  };
  writeJsonAtomic(next.paths.runJson, next);
  return next;
}

function appendEvent(
  manifest: ApplyBatchRunManifest,
  events: ApplyBatchEvent[],
  deps: ApplyBatchRunnerDeps,
  event: Omit<ApplyBatchEvent, "eventId" | "timestampISO">,
): ApplyBatchEvent {
  const nextEvent: ApplyBatchEvent = {
    ...event,
    eventId: String(events.length + 1),
    timestampISO: nowIso(deps.now ?? (() => new Date())),
  };
  events.push(nextEvent);
  fs.appendFileSync(manifest.paths.eventsJsonl, `${JSON.stringify(nextEvent)}\n`, "utf-8");
  return nextEvent;
}

function selectJobs(
  rankedJobs: RankedApplyJob[],
  manifest: ApplyBatchRunManifest,
): ApplyBatchReportJob[] {
  const applyJobs = rankedJobs
    .filter(
      (job) => job.decision === "apply" && job.fitScore >= manifest.config.applyThreshold,
    )
    .slice(0, manifest.config.maxJobsToApply)
    .map(toReportJob);

  if (
    !manifest.config.allowReviewQueue ||
    applyJobs.length >= manifest.config.maxJobsToApply
  ) {
    return applyJobs;
  }

  const remainingSlots = manifest.config.maxJobsToApply - applyJobs.length;
  const reviewJobs = rankedJobs
    .filter((job) => job.decision === "review")
    .slice(0, remainingSlots)
    .map(toReportJob);

  return [...applyJobs, ...reviewJobs];
}

function createJobArtifacts(
  manifest: ApplyBatchRunManifest,
  job: ApplyBatchReportJob,
): {
  jobDir: string;
  applyRequestPath: string;
  planPath: string;
  executionReportPath: string;
  providerLogsPath: string;
  stdoutPath: string;
  stderrPath: string;
} {
  const jobDir = path.join(manifest.runDir, "jobs", job.rowKey);
  fs.mkdirSync(jobDir, { recursive: true });
  return {
    jobDir,
    applyRequestPath: path.join(jobDir, "apply_request.json"),
    planPath: path.join(jobDir, "plan.json"),
    executionReportPath: path.join(jobDir, "execution_report.json"),
    providerLogsPath: path.join(jobDir, "provider_logs.jsonl"),
    stdoutPath: path.join(jobDir, "stdout.txt"),
    stderrPath: path.join(jobDir, "stderr.txt"),
  };
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function parseRunnerJson(stdout: string): ApplyAgentRunnerResponse {
  const trimmed = stdout.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Apply-agent runner returned non-JSON output.");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as ApplyAgentRunnerResponse;
}

async function defaultRunApplyAgent(input: {
  repoRoot: string;
  manifest: ApplyBatchRunManifest;
  job: ApplyBatchReportJob;
  safeStopBeforeSubmit: boolean;
}): Promise<ApplyAgentRunResult> {
  const requestPayload = {
    transport: "api",
    mode: "live",
    provider: input.job.provider,
    url: input.job.applyUrl,
    company: input.job.company,
    role: input.job.roleTitle,
    shouldApply: true,
    safeStop: input.safeStopBeforeSubmit,
    visibleBrowser: input.manifest.config.visibleBrowser,
  };

  console.error(`[BATCH_DEBUG] defaultRunApplyAgent: runId=${input.manifest.runId} rowKey=${input.job.rowKey} provider=${input.job.provider} visibleBrowser=${input.manifest.config.visibleBrowser}`);

  const commandResult = await runCommand(
    "./node_modules/.bin/tsx",
    [
      "apps/llm/agents/scripts/apply-agent/run-local.ts",
      "--transport",
      "api",
      "--mode",
      "live",
      "--provider",
      input.job.provider,
      "--url",
      input.job.applyUrl,
      "--company",
      input.job.company,
      "--role",
      input.job.roleTitle,
      "--should-apply",
      "true",
      "--safe-stop",
      input.safeStopBeforeSubmit ? "true" : "false",
      "--visible-browser",
      input.manifest.config.visibleBrowser ? "true" : "false",
    ],
    input.repoRoot,
  );

  if (commandResult.exitCode !== 0) {
    return {
      requestPayload,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
      errorMessage:
        commandResult.stdout.trim() ||
        commandResult.stderr.trim() ||
        `Apply-agent runner exited with code ${commandResult.exitCode}.`,
    };
  }

  try {
    return {
      requestPayload,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
      response: parseRunnerJson(commandResult.stdout),
    };
  } catch (error) {
    return {
      requestPayload,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
      errorMessage:
        error instanceof Error ? error.message : "Failed to parse apply-agent output.",
    };
  }
}

async function defaultNovaAvailability(): Promise<NovaAvailability> {
  if (process.env.USE_REAL_NOVA_ACT === "false") {
    return {
      available: false,
      reason: "nova_unavailable: USE_REAL_NOVA_ACT=false",
    };
  }
  if (!cleanText(process.env.NOVA_ACT_API)) {
    return {
      available: false,
      reason: "nova_unavailable: NOVA_ACT_API is not configured",
    };
  }
  return { available: true };
}

function looksLikeNovaUnavailable(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("nova_unavailable") ||
    normalized.includes("nova_act_api is required") ||
    normalized.includes("nova_act is not installed") ||
    normalized.includes("no module named 'nova_act'") ||
    normalized.includes("no module named \"nova_act\"")
  );
}

function serializeProviderLogs(
  response?: ApplyAgentRunnerResponse,
): string | undefined {
  if (!response?.actionLogs?.length) {
    return undefined;
  }
  return `${response.actionLogs.map((log) => JSON.stringify(log)).join("\n")}\n`;
}

function deriveAppliedStatus(
  response: ApplyAgentRunnerResponse | undefined,
  safeStopBeforeSubmit: boolean,
): {
  applyStatus: AppliedJobStatus;
  statusReason: string;
} {
  if (!response) {
    return {
      applyStatus: "failed",
      statusReason: "Apply-agent runtime did not return a result.",
    };
  }

  const blockedFillCount = response.fill?.counts?.blocked ?? 0;
  const blockedBrowserCount = response.browser?.summary?.blocked_count ?? 0;
  const browserCanContinue = response.browser?.summary?.can_continue;
  const message = response.message?.trim() || "Apply-agent runtime finished.";

  if (blockedFillCount > 0) {
    return {
      applyStatus: "blocked",
      statusReason: message,
    };
  }

  if (
    response.executed === true &&
    (safeStopBeforeSubmit ||
      blockedBrowserCount > 0 ||
      browserCanContinue === false ||
      /safe[- ]?stop|final submit/i.test(message))
  ) {
    return {
      applyStatus: "safe_stopped",
      statusReason: message,
    };
  }

  if (response.executed === true) {
    return {
      applyStatus: "applied",
      statusReason: message,
    };
  }

  if (response.status === "failed" || blockedBrowserCount > 0 || browserCanContinue === false) {
    return {
      applyStatus: "blocked",
      statusReason: message,
    };
  }

  return {
    applyStatus: "failed",
    statusReason: message,
  };
}

function normalizeApplyResultStatus(
  applyStatus: AppliedJobStatus,
  responseStatus?: string,
): string {
  if (
    applyStatus === "safe_stopped" ||
    applyStatus === "blocked" ||
    applyStatus === "skipped" ||
    applyStatus === "failed"
  ) {
    return applyStatus;
  }

  if (applyStatus === "applied") {
    return "applied";
  }

  return responseStatus || applyStatus;
}

function countSuccessfulApplies(appliedJobs: ApplyBatchAppliedJob[]): number {
  return appliedJobs.filter(
    (job) =>
      job.applyStatus === "applied" ||
      job.applyStatus === "safe_stopped",
  ).length;
}

function buildDemoDiscovery(): DiscoverResult {
  return {
    resolvedUrl: "demo://apply-batch",
    sourceType: "demo",
    jobs: [
      {
        rowKey: "demo_1",
        company: "Anthropic",
        roleTitle: "Backend Engineer Intern",
        location: "Remote",
        applyUrl: "https://boards.greenhouse.io/anthropic/jobs/123",
        sourceUrl: "demo://apply-batch",
        sourceType: "markdown",
        raw: {},
        provider: "greenhouse",
      },
      {
        rowKey: "demo_2",
        company: "OpenAI",
        roleTitle: "Machine Learning Intern",
        location: "San Francisco, CA",
        applyUrl: "https://jobs.ashbyhq.com/openai/123/application",
        sourceUrl: "demo://apply-batch",
        sourceType: "markdown",
        raw: {},
        provider: "ashby",
      },
      {
        rowKey: "demo_3",
        company: "Rippling",
        roleTitle: "Software Engineer Intern",
        location: "Remote",
        applyUrl: "https://www.rippling.com/careers/job/123",
        sourceUrl: "demo://apply-batch",
        sourceType: "markdown",
        raw: {},
        provider: "rippling",
      },
    ],
  };
}

export async function runApplyBatchFromGithub(
  request: ApplyBatchRunRequest,
  deps: ApplyBatchRunnerDeps = {},
): Promise<{
  manifest: ApplyBatchRunManifest;
  report: ApplyBatchReport;
  events: ApplyBatchEvent[];
}> {
  const now = deps.now ?? (() => new Date());
  const repoRoot = deps.repoRoot ?? findRepoRoot();
  const manifest = writeManifest(buildManifest(request, deps), deps);
  fs.writeFileSync(manifest.paths.eventsJsonl, "", "utf-8");

  const events: ApplyBatchEvent[] = [];
  let rankedJobs: RankedApplyJob[] = [];
  let selectedJobs: ApplyBatchReportJob[] = [];
  let appliedJobs: ApplyBatchAppliedJob[] = [];
  const errors: string[] = [];

  const profile = getDefaultApplyBatchCandidateProfile({
    ...request.profile,
    candidateId: cleanText(request.candidateId),
    candidateLabel: manifest.candidateLabel,
  });

  writeJsonAtomic(manifest.paths.runJson, {
    ...manifest,
    profile,
  });

  appendEvent(manifest, events, deps, {
    type: "status",
    phase: "started",
    message: "Batch apply run started.",
    data: {
      mode: manifest.mode,
      sourceUrl: manifest.sourceUrl,
    },
  });

  try {
    const discovery =
      manifest.mode === "demo"
        ? buildDemoDiscovery()
        : await (deps.discoverJobs ?? fetchAndParseSimplifyJobs)(manifest.sourceUrl);

    appendEvent(manifest, events, deps, {
      type: "status",
      phase: "discovering",
      message: "Fetching and parsing the SimplifyJobs list.",
      data: {
        sourceUrl: manifest.sourceUrl,
      },
    });

    writeJsonAtomic(manifest.paths.jobsRawJson, {
      sourceUrl: manifest.sourceUrl,
      resolvedUrl: discovery.resolvedUrl,
      sourceType: discovery.sourceType,
      rows: discovery.jobs,
    });

    for (const row of discovery.jobs.slice(0, 100)) {
      appendEvent(manifest, events, deps, {
        type: "job_discovered",
        message: `Discovered ${row.company} ${row.roleTitle}.`,
        data: {
          rowKey: row.rowKey,
          company: row.company,
          roleTitle: row.roleTitle,
          location: row.location,
          provider: row.provider,
        },
      });
    }

    appendEvent(manifest, events, deps, {
      type: "status",
      phase: "ranking",
      message: "Scoring and ranking jobs for fit.",
      data: {
        discoveredCount: discovery.jobs.length,
      },
    });

    rankedJobs = await rankApplyBatchJobs(discovery.jobs, profile, {
      applyThreshold: manifest.config.applyThreshold,
      maxConcurrency: manifest.config.maxFitConcurrency,
      snippetLoader:
        deps.snippetLoader ??
        (async (job) => await loadApplyBatchJobSnippet(job.applyUrl)),
    });

    writeJsonAtomic(manifest.paths.jobsRankedJson, rankedJobs);

    for (const job of rankedJobs.slice(0, 100)) {
      appendEvent(manifest, events, deps, {
        type: "job_scored",
        message: `Scored ${job.company} ${job.roleTitle} at ${job.fitScore}.`,
        data: {
          rowKey: job.rowKey,
          company: job.company,
          roleTitle: job.roleTitle,
          fitScore: job.fitScore,
          decision: job.decision,
          fitReasons: job.fitReasons,
        },
      });
    }

    selectedJobs = selectJobs(rankedJobs, manifest);
    for (const job of selectedJobs) {
      appendEvent(manifest, events, deps, {
        type: "job_selected",
        message: `Selected ${job.company} ${job.roleTitle} for ${job.decision}.`,
        data: {
          rowKey: job.rowKey,
          company: job.company,
          roleTitle: job.roleTitle,
          fitScore: job.fitScore,
          provider: job.provider,
        },
      });
    }

    if (manifest.mode === "nova") {
      appendEvent(manifest, events, deps, {
        type: "status",
        phase: "applying",
        message: "Launching apply-agent runs for selected jobs.",
        data: {
          selectedCount: selectedJobs.filter((job) => job.decision === "apply").length,
          maxApplyConcurrency: manifest.config.maxApplyConcurrency,
        },
      });

      let novaAvailability = await (
        deps.checkNovaAvailability ?? defaultNovaAvailability
      )();

      const runApplyAgent = deps.runApplyAgent ?? defaultRunApplyAgent;
      const output = [...selectedJobs];

      for (let index = 0; index < output.length; index += manifest.config.maxApplyConcurrency) {
        const chunk = output.slice(index, index + manifest.config.maxApplyConcurrency);
        const results = await Promise.all(
          chunk.map(async (job) => {
            const artifactPaths = createJobArtifacts(manifest, job);
            const safeStopBeforeSubmit = !manifest.config.autoSubmit;

            if (job.decision !== "apply") {
              const skipped = toAppliedJob(job, {
                applyStatus: "skipped",
                statusReason: "Selected for review queue only.",
                applyResult: {
                  status: "review",
                  executed: false,
                  safeStopBeforeSubmit: true,
                  message: "Selected for review queue only.",
                  executionReportPath: artifactPaths.executionReportPath,
                },
                artifacts: {
                  applyRequestPath: artifactPaths.applyRequestPath,
                  executionReportPath: artifactPaths.executionReportPath,
                },
              });
              writeJsonAtomic(artifactPaths.applyRequestPath, {
                ...job,
                reason: "manual_review_only",
              });
              writeJsonAtomic(artifactPaths.executionReportPath, {
                status: skipped.applyStatus,
                message: skipped.statusReason,
              });
              appendEvent(manifest, events, deps, {
                type: "apply_blocked",
                message: `${job.company} ${job.roleTitle} is queued for manual review only.`,
                data: {
                  rowKey: job.rowKey,
                  reason: "manual_review_only",
                },
              });
              return skipped;
            }

            if (!job.supportedForAutomation) {
              const skipped = toAppliedJob(job, {
                applyStatus: "skipped",
                statusReason: `Provider ${job.provider} is not supported for live automation.`,
                applyResult: {
                  status: "skipped",
                  executed: false,
                  safeStopBeforeSubmit: true,
                  message: `Provider ${job.provider} is not supported for live automation.`,
                  executionReportPath: artifactPaths.executionReportPath,
                },
                artifacts: {
                  applyRequestPath: artifactPaths.applyRequestPath,
                  executionReportPath: artifactPaths.executionReportPath,
                },
              });
              writeJsonAtomic(artifactPaths.applyRequestPath, {
                ...job,
                reason: "unsupported_provider",
              });
              writeJsonAtomic(artifactPaths.executionReportPath, {
                status: skipped.applyStatus,
                message: skipped.statusReason,
              });
              appendEvent(manifest, events, deps, {
                type: "apply_blocked",
                message: `${job.provider} automation is not implemented for ${job.company} ${job.roleTitle}.`,
                data: {
                  rowKey: job.rowKey,
                  reason: "unsupported_provider",
                },
              });
              return skipped;
            }

            if (!novaAvailability.available) {
              const reason = novaAvailability.reason || "nova_unavailable";
              const skipped = toAppliedJob(job, {
                applyStatus: "skipped",
                statusReason: reason,
                applyResult: {
                  status: "skipped",
                  executed: false,
                  safeStopBeforeSubmit,
                  message: reason,
                  executionReportPath: artifactPaths.executionReportPath,
                },
                artifacts: {
                  applyRequestPath: artifactPaths.applyRequestPath,
                  executionReportPath: artifactPaths.executionReportPath,
                },
              });
              writeJsonAtomic(artifactPaths.applyRequestPath, {
                ...job,
                reason: "nova_unavailable",
              });
              writeJsonAtomic(artifactPaths.executionReportPath, {
                status: skipped.applyStatus,
                message: skipped.statusReason,
              });
              appendEvent(manifest, events, deps, {
                type: "apply_blocked",
                message: `Nova runtime unavailable for ${job.company} ${job.roleTitle}.`,
                data: {
                  rowKey: job.rowKey,
                  reason: "nova_unavailable",
                },
              });
              return skipped;
            }

            appendEvent(manifest, events, deps, {
              type: "apply_started",
              message: `Starting ${job.provider} apply flow for ${job.company} ${job.roleTitle}.`,
              data: {
                rowKey: job.rowKey,
                company: job.company,
                roleTitle: job.roleTitle,
                provider: job.provider,
              },
            });

            const applyRun = await runApplyAgent({
              repoRoot,
              manifest,
              job,
              safeStopBeforeSubmit,
            });

            writeJsonAtomic(artifactPaths.applyRequestPath, applyRun.requestPayload);
            writeJsonAtomic(artifactPaths.planPath, []);
            writeJsonAtomic(
              artifactPaths.planPath,
              applyRun.response?.browserSession?.steps ??
                applyRun.response?.executionSteps ??
                [],
            );
            fs.writeFileSync(artifactPaths.stdoutPath, applyRun.stdout, "utf-8");
            fs.writeFileSync(artifactPaths.stderrPath, applyRun.stderr, "utf-8");

            if (applyRun.errorMessage) {
              if (looksLikeNovaUnavailable(applyRun.errorMessage)) {
                novaAvailability = {
                  available: false,
                  reason: "nova_unavailable",
                };
                const skipped = toAppliedJob(job, {
                  applyStatus: "skipped",
                  statusReason: "nova_unavailable",
                  applyResult: {
                    status: "skipped",
                    executed: false,
                    safeStopBeforeSubmit,
                    message: "nova_unavailable",
                    executionReportPath: artifactPaths.executionReportPath,
                  },
                  artifacts: {
                    applyRequestPath: artifactPaths.applyRequestPath,
                    planPath: artifactPaths.planPath,
                    executionReportPath: artifactPaths.executionReportPath,
                  },
                });
                writeJsonAtomic(artifactPaths.executionReportPath, {
                  status: skipped.applyStatus,
                  message: skipped.statusReason,
                });
                appendEvent(manifest, events, deps, {
                  type: "apply_blocked",
                  message: `Nova runtime unavailable for ${job.company} ${job.roleTitle}.`,
                  data: {
                    rowKey: job.rowKey,
                    reason: "nova_unavailable",
                  },
                });
                return skipped;
              }

              const failed = toAppliedJob(job, {
                applyStatus: "failed",
                statusReason: applyRun.errorMessage,
                applyResult: {
                  status: "failed",
                  executed: false,
                  safeStopBeforeSubmit,
                  message: applyRun.errorMessage,
                  executionReportPath: artifactPaths.executionReportPath,
                },
                artifacts: {
                  applyRequestPath: artifactPaths.applyRequestPath,
                  planPath: artifactPaths.planPath,
                  executionReportPath: artifactPaths.executionReportPath,
                },
              });
              writeJsonAtomic(artifactPaths.executionReportPath, {
                status: failed.applyStatus,
                message: failed.statusReason,
              });
              appendEvent(manifest, events, deps, {
                type: "apply_blocked",
                message: `Apply flow blocked for ${job.company} ${job.roleTitle}.`,
                data: {
                  rowKey: job.rowKey,
                  reason: applyRun.errorMessage,
                },
              });
              return failed;
            }

            const providerLogs = serializeProviderLogs(applyRun.response);
            if (providerLogs) {
              fs.writeFileSync(artifactPaths.providerLogsPath, providerLogs, "utf-8");
            }

            writeJsonAtomic(
              artifactPaths.executionReportPath,
              applyRun.response ?? {
                status: "failed",
                message: "Apply-agent runtime returned no response.",
              },
            );

            if (
              manifest.config.visibleBrowser &&
              applyRun.response?.browserOpened !== true
            ) {
              const visibleReason =
                applyRun.response?.message?.trim() ||
                applyRun.response?.transportSummary?.trim() ||
                "Visible browser was requested, but no visible Nova browser session was opened.";

              appendEvent(manifest, events, deps, {
                type: "apply_blocked",
                message: `Visible browser launch failed for ${job.company} ${job.roleTitle}.`,
                data: {
                  rowKey: job.rowKey,
                  reason: visibleReason,
                },
              });

              return toAppliedJob(job, {
                applyStatus: "blocked",
                statusReason: visibleReason,
                applyResult: {
                  status: "blocked",
                  executed: false,
                  safeStopBeforeSubmit,
                  message: visibleReason,
                  executionReportPath: artifactPaths.executionReportPath,
                },
                artifacts: {
                  applyRequestPath: artifactPaths.applyRequestPath,
                  planPath: artifactPaths.planPath,
                  executionReportPath: artifactPaths.executionReportPath,
                },
              });
            }

            for (const step of applyRun.response?.actionLogs ?? []) {
              appendEvent(manifest, events, deps, {
                type: "apply_step",
                message: step.detail || `Apply step ${step.action || "unknown"} completed.`,
                data: {
                  rowKey: job.rowKey,
                  stepId: step.stepId,
                  action: step.action,
                  detail: step.detail,
                },
              });
            }

            const appliedStatus = deriveAppliedStatus(
              applyRun.response,
              safeStopBeforeSubmit,
            );
            const result = toAppliedJob(job, {
              applyStatus: appliedStatus.applyStatus,
              statusReason: appliedStatus.statusReason,
              applyResult: {
                status: normalizeApplyResultStatus(
                  appliedStatus.applyStatus,
                  applyRun.response?.status,
                ),
                executed: applyRun.response?.executed === true,
                safeStopBeforeSubmit,
                message:
                  applyRun.response?.message ||
                  applyRun.response?.transportSummary ||
                  appliedStatus.statusReason,
                executionReportPath: artifactPaths.executionReportPath,
              },
              artifacts: {
                applyRequestPath: artifactPaths.applyRequestPath,
                planPath: artifactPaths.planPath,
                executionReportPath: artifactPaths.executionReportPath,
                providerLogsPath: providerLogs ? artifactPaths.providerLogsPath : undefined,
              },
            });

            appendEvent(manifest, events, deps, {
              type: "apply_done",
              message: `Apply flow finished for ${job.company} ${job.roleTitle}.`,
              data: {
                rowKey: job.rowKey,
                status: result.applyStatus,
                executed: result.applyResult?.executed === true,
                executionReportPath: artifactPaths.executionReportPath,
              },
            });

            return result;
          }),
        );

        appliedJobs.push(...results);
      }
    } else {
      appendEvent(manifest, events, deps, {
        type: "status",
        phase: "deterministic_complete",
        message: "Deterministic ranking completed. No browser automation was launched.",
        data: {
          selectedCount: selectedJobs.length,
        },
      });
    }

    const report: ApplyBatchReport = {
      version: "1.0",
      runId: manifest.runId,
      mode: manifest.mode,
      candidate: {
        candidateId: manifest.candidateId,
        candidateLabel: manifest.candidateLabel,
        candidateSlug: manifest.candidateSlug,
      },
      source: {
        sourceUrl: manifest.sourceUrl,
        resolvedUrl: discovery.resolvedUrl,
        sourceType: discovery.sourceType,
      },
      summary: {
        discoveredCount: rankedJobs.length,
        rankedCount: rankedJobs.length,
        selectedCount: selectedJobs.length,
        appliedCount: countSuccessfulApplies(appliedJobs),
        reviewCount: rankedJobs.filter((job) => job.decision === "review").length,
        skippedCount: rankedJobs.filter((job) => job.decision === "skip").length,
        applyThreshold: manifest.config.applyThreshold,
        maxJobsToApply: manifest.config.maxJobsToApply,
        usedFallback: false,
      },
      selectedJobs,
      rankedJobs: rankedJobs.map(toReportJob),
      appliedJobs,
      errors,
      createdAtISO: nowIso(now),
    };

    writeJsonAtomic(manifest.paths.reportJson, report);
    const completedManifest = writeManifest(
      {
        ...manifest,
        status: "completed",
        finishedAtISO: nowIso(now),
      },
      deps,
    );

    appendEvent(completedManifest, events, deps, {
      type: "done",
      message: "Batch apply report ready.",
      data: {
        reportPath: completedManifest.paths.reportJson,
        selectedCount: selectedJobs.length,
        appliedCount: report.summary.appliedCount,
      },
    });

    return {
      manifest: completedManifest,
      report,
      events,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown batch apply error";
    errors.push(message);
    const failedManifest = writeManifest(
      {
        ...manifest,
        status: "failed",
        finishedAtISO: nowIso(now),
        errors: [...manifest.errors, message],
      },
      deps,
    );

    const report: ApplyBatchReport = {
      version: "1.0",
      runId: failedManifest.runId,
      mode: failedManifest.mode,
      candidate: {
        candidateId: failedManifest.candidateId,
        candidateLabel: failedManifest.candidateLabel,
        candidateSlug: failedManifest.candidateSlug,
      },
      source: {
        sourceUrl: failedManifest.sourceUrl,
        resolvedUrl: failedManifest.sourceUrl,
        sourceType: failedManifest.mode === "demo" ? "demo" : "markdown",
      },
      summary: {
        discoveredCount: rankedJobs.length,
        rankedCount: rankedJobs.length,
        selectedCount: selectedJobs.length,
        appliedCount: countSuccessfulApplies(appliedJobs),
        reviewCount: rankedJobs.filter((job) => job.decision === "review").length,
        skippedCount: rankedJobs.filter((job) => job.decision === "skip").length,
        applyThreshold: failedManifest.config.applyThreshold,
        maxJobsToApply: failedManifest.config.maxJobsToApply,
        usedFallback: true,
      },
      selectedJobs,
      rankedJobs: rankedJobs.map(toReportJob),
      appliedJobs,
      errors,
      createdAtISO: nowIso(now),
    };

    writeJsonAtomic(failedManifest.paths.reportJson, report);
    appendEvent(failedManifest, events, deps, {
      type: "error",
      message,
      data: {
        reportPath: failedManifest.paths.reportJson,
      },
    });

    return {
      manifest: failedManifest,
      report,
      events,
    };
  }
}

export function buildTempApplyBatchBaseDir(prefix = "apply-batch-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
