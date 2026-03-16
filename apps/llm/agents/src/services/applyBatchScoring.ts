import { detectApplyBatchProvider, isAutomationSupportedProvider, type ApplyBatchProvider } from "./applyBatchProviderDetector.js";
import type { SimplifyGithubJobRow } from "./simplifyGithubJobs.js";

export type CandidateTargetProfile = {
  candidateId?: string;
  candidateLabel: string;
  roleFamilies: string[];
  seniority: string[];
  locations: string[];
  strongPreference: string[];
  avoid: string[];
  targetKeywords?: string[];
  negativeKeywords?: string[];
};

export type RankedApplyJob = SimplifyGithubJobRow & {
  snippet?: string;
  fitScore: number;
  deterministicScore: number;
  semanticFitScore?: number;
  fitReasons: string[];
  decision: "apply" | "review" | "skip";
  provider: ApplyBatchProvider;
  supportedForAutomation: boolean;
};

const STRONG_POSITIVE_TOKENS = [
  "software",
  "engineer",
  "swe",
  "backend",
  "fullstack",
  "full-stack",
  "platform",
  "infrastructure",
  "distributed",
  "systems",
  "api",
  "data",
  "machine learning",
  "ml",
  "ai",
];

const INTERNSHIP_TOKENS = ["intern", "internship", "co-op", "coop"];
const BACKEND_TOKENS = ["backend", "api", "platform", "infrastructure", "distributed", "systems"];
const ML_DATA_TOKENS = ["ml", "machine learning", "ai", "data", "pipeline", "etl", "scientist"];
const STRONG_TITLE_TOKENS = [
  "software",
  "engineer",
  "swe",
  "backend",
  "developer",
  "platform",
  "infrastructure",
  "api",
  "data",
  "machine learning",
  "ml",
  "ai",
  "scientist",
];
const STRONG_NEGATIVE_TOKENS = [
  "sales",
  "marketing",
  "recruiter",
  "hr",
  "operations",
  "accounting",
  "civil",
  "mechanical",
  "nurse",
  "clinical",
  "real estate",
  "teacher",
  "finance",
];

const DEFAULT_CANDIDATE_PROFILE: CandidateTargetProfile = {
  candidateLabel: "default-candidate",
  roleFamilies: [
    "Software Engineer",
    "Backend Engineer",
    "ML Engineer",
    "Data Engineer",
    "Data Scientist",
  ],
  seniority: ["Internship", "Intern", "Co-op"],
  locations: ["any"],
  strongPreference: ["backend", "swe", "software engineer", "machine learning", "data engineer"],
  avoid: [
    "sales",
    "marketing",
    "hr",
    "finance-only",
    "operations-only",
    "mechanical",
    "civil",
    "nursing",
    "clinical",
    "non-tech",
  ],
  targetKeywords: STRONG_POSITIVE_TOKENS,
  negativeKeywords: STRONG_NEGATIVE_TOKENS,
};

function tokenize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+/#.\- ]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenPattern(token: string): RegExp {
  const normalized = tokenize(token);
  const escaped = escapeRegex(normalized).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

function includesAny(text: string, tokens: string[]): string[] {
  return tokens.filter((token) => tokenPattern(token).test(text));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons.filter(Boolean))].slice(0, 6);
}

async function scoreSemanticallyWithBedrock(
  job: SimplifyGithubJobRow,
  profile: CandidateTargetProfile,
  deterministicScore: number,
  snippet?: string,
): Promise<{ semanticFitScore: number; fitReasons: string[] } | null> {
  if (process.env.USE_REAL_BEDROCK !== "true") {
    return null;
  }

  try {
    const aws = await import("@aws-sdk/client-bedrock-runtime");
    const modelId = process.env.BEDROCK_MODEL_ID;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!modelId) {
      return null;
    }

    const client = new aws.BedrockRuntimeClient({ region });
    const prompt = [
      "You are scoring internship job fit for a candidate auto-apply agent.",
      "Use only the provided role title, company, snippet, and target profile.",
      "Return strict JSON: {\"semanticFitScore\":0-100,\"fitReasons\":[\"...\",\"...\"]}.",
      `Candidate profile target role families: ${profile.roleFamilies.join(", ")}`,
      `Candidate strong preference: ${profile.strongPreference.join(", ")}`,
      `Candidate avoid list: ${profile.avoid.join(", ")}`,
      `Role title: ${job.roleTitle}`,
      `Company: ${job.company}`,
      `Location: ${job.location}`,
      `Provider: ${job.provider}`,
      `Deterministic score: ${deterministicScore}`,
      `Job snippet: ${snippet || "none"}`,
    ].join("\n");

    const response = await client.send(
      new aws.ConverseCommand({
        modelId,
        messages: [
          {
            role: "user",
            content: [{ text: prompt }],
          },
        ],
      }),
    );

    const text = response.output?.message?.content?.flatMap((part) => ("text" in part ? [part.text ?? ""] : [])).join("\n") ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      semanticFitScore?: number;
      fitReasons?: string[];
    };

    if (typeof parsed.semanticFitScore !== "number") {
      return null;
    }

    return {
      semanticFitScore: clampScore(parsed.semanticFitScore),
      fitReasons: Array.isArray(parsed.fitReasons)
        ? parsed.fitReasons
            .filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
            .slice(0, 4)
        : [],
    };
  } catch {
    return null;
  }
}

export function getDefaultApplyBatchCandidateProfile(
  overrides?: Partial<CandidateTargetProfile>,
): CandidateTargetProfile {
  const hasValues = (items?: string[]): items is string[] =>
    Array.isArray(items) && items.length > 0;

  return {
    ...DEFAULT_CANDIDATE_PROFILE,
    ...overrides,
    candidateLabel: overrides?.candidateLabel?.trim() || DEFAULT_CANDIDATE_PROFILE.candidateLabel,
    roleFamilies: hasValues(overrides?.roleFamilies) ? overrides.roleFamilies : DEFAULT_CANDIDATE_PROFILE.roleFamilies,
    seniority: hasValues(overrides?.seniority) ? overrides.seniority : DEFAULT_CANDIDATE_PROFILE.seniority,
    locations: hasValues(overrides?.locations) ? overrides.locations : DEFAULT_CANDIDATE_PROFILE.locations,
    strongPreference: hasValues(overrides?.strongPreference) ? overrides.strongPreference : DEFAULT_CANDIDATE_PROFILE.strongPreference,
    avoid: hasValues(overrides?.avoid) ? overrides.avoid : DEFAULT_CANDIDATE_PROFILE.avoid,
    targetKeywords: hasValues(overrides?.targetKeywords) ? overrides.targetKeywords : DEFAULT_CANDIDATE_PROFILE.targetKeywords,
    negativeKeywords: hasValues(overrides?.negativeKeywords) ? overrides.negativeKeywords : DEFAULT_CANDIDATE_PROFILE.negativeKeywords,
  };
}

export async function rankApplyBatchJob(
  job: SimplifyGithubJobRow,
  profile: CandidateTargetProfile,
  options?: {
    applyThreshold?: number;
    snippet?: string;
  },
): Promise<RankedApplyJob> {
  const threshold = options?.applyThreshold ?? 70;
  const normalizedTitle = tokenize(job.roleTitle);
  const normalizedText = tokenize(
    [job.roleTitle, job.company, job.location, options?.snippet ?? ""].join(" "),
  );

  const positiveMatches = includesAny(normalizedText, profile.targetKeywords ?? STRONG_POSITIVE_TOKENS);
  const positiveTitleMatches = includesAny(normalizedTitle, STRONG_TITLE_TOKENS);
  const internshipMatches = includesAny(normalizedText, INTERNSHIP_TOKENS);
  const internshipTitleMatches = includesAny(normalizedTitle, INTERNSHIP_TOKENS);
  const backendMatches = includesAny(normalizedText, BACKEND_TOKENS);
  const mlDataMatches = includesAny(normalizedText, ML_DATA_TOKENS);
  const backendTitleMatches = includesAny(normalizedTitle, BACKEND_TOKENS);
  const mlDataTitleMatches = includesAny(normalizedTitle, ML_DATA_TOKENS);
  const negativeMatches = includesAny(normalizedText, profile.negativeKeywords ?? STRONG_NEGATIVE_TOKENS);
  const hasSystemsEngineerTitle = tokenPattern("systems engineer").test(normalizedTitle);
  const hasSoftwareSystemsContext =
    tokenPattern("software").test(normalizedTitle) ||
    tokenPattern("platform").test(normalizedTitle) ||
    tokenPattern("backend").test(normalizedTitle) ||
    tokenPattern("infrastructure").test(normalizedTitle);
  const ambiguousInternTitle =
    internshipTitleMatches.length > 0 && positiveTitleMatches.length === 0;

  const positiveOverride = positiveMatches.some((token) =>
    ["software", "engineer", "swe", "backend", "machine learning", "ml", "data"].includes(token),
  );

  let deterministicScore = 10;
  const reasons: string[] = [];
  let forceReview = false;

  if (positiveMatches.length > 0) {
    deterministicScore += 35;
    reasons.push(`Role title matches target tech family: ${positiveMatches.slice(0, 3).join(", ")}.`);
  }

  if (internshipMatches.length > 0) {
    deterministicScore += 20;
    reasons.push("Internship/co-op signal is present in the role.");
  } else if (positiveMatches.length > 0) {
    reasons.push("Role looks technical, but the posting does not clearly say intern.");
  }

  if (backendMatches.length > 0) {
    deterministicScore += 15;
    reasons.push(`Backend/SWE signals are present: ${backendMatches.slice(0, 3).join(", ")}.`);
  }

  if (mlDataMatches.length > 0) {
    deterministicScore += 10;
    reasons.push(`ML/data signals are present: ${mlDataMatches.slice(0, 3).join(", ")}.`);
  }

  let titleSpecializationBoost = 0;
  if (backendTitleMatches.some((token) => token === "backend")) {
    titleSpecializationBoost += 8;
  }
  if (
    backendTitleMatches.some((token) =>
      ["platform", "infrastructure", "distributed"].includes(token),
    )
  ) {
    titleSpecializationBoost += 6;
  }
  if (
    mlDataTitleMatches.some((token) =>
      ["machine learning", "ml", "ai"].includes(token),
    )
  ) {
    titleSpecializationBoost += 6;
  }
  if (
    mlDataTitleMatches.some((token) =>
      ["data", "pipeline", "etl", "scientist"].includes(token),
    )
  ) {
    titleSpecializationBoost += 4;
  }
  if (titleSpecializationBoost > 0) {
    deterministicScore += Math.min(titleSpecializationBoost, 12);
    reasons.push(
      `Title-specific technical focus boosts fit: ${positiveTitleMatches.slice(0, 3).join(", ")}.`,
    );
  }

  if (ambiguousInternTitle) {
    deterministicScore -= 12;
    reasons.push("Title says intern, but it is ambiguous about SWE/ML/Data scope.");
  }

  if (hasSystemsEngineerTitle && !hasSoftwareSystemsContext) {
    deterministicScore -= 10;
    forceReview = true;
    reasons.push("Systems Engineer title is treated cautiously without explicit software/platform/backend context.");
  }

  if (negativeMatches.length > 0 && !positiveOverride) {
    deterministicScore -= 40;
    reasons.push(`Negative family detected: ${negativeMatches.slice(0, 3).join(", ")}.`);
  }

  if (job.provider === "other") {
    reasons.push("Provider is unsupported for full automation, so this may require manual review.");
  } else if (!isAutomationSupportedProvider(job.provider)) {
    reasons.push(`Provider ${job.provider} is detected, but full automation is not implemented yet.`);
  } else {
    reasons.push(`Provider ${job.provider} supports the existing apply-agent runtime.`);
  }

  deterministicScore = clampScore(deterministicScore);

  const semantic = await scoreSemanticallyWithBedrock(job, profile, deterministicScore, options?.snippet);
  const fitScore = semantic
    ? clampScore(0.6 * deterministicScore + 0.4 * semantic.semanticFitScore)
    : deterministicScore;

  let decision: RankedApplyJob["decision"] = "skip";
  const supportedForAutomation = isAutomationSupportedProvider(job.provider);

  if (negativeMatches.length > 0 && !positiveOverride && fitScore < threshold) {
    decision = "skip";
  } else if (fitScore >= threshold && supportedForAutomation) {
    decision = internshipTitleMatches.length > 0 ? "apply" : "review";
  } else if (fitScore >= threshold || positiveMatches.length > 0) {
    decision = "review";
  }

  if (forceReview && decision === "apply") {
    decision = "review";
  }

  const fitReasons = uniqueReasons([
    ...(decision === "review" && fitScore >= threshold && internshipTitleMatches.length === 0
      ? ["No explicit intern/co-op signal appears in the role title, so this is capped at review."]
      : []),
    ...(decision === "review" && forceReview
      ? ["Systems Engineer roles need explicit software/platform/backend context before auto-apply is allowed."]
      : []),
    ...reasons,
    ...(semantic?.fitReasons ?? []),
  ]);

  return {
    ...job,
    snippet: options?.snippet,
    fitScore,
    deterministicScore,
    semanticFitScore: semantic?.semanticFitScore,
    fitReasons: fitReasons.slice(0, 6),
    decision,
    provider: detectApplyBatchProvider(job.applyUrl),
    supportedForAutomation,
  };
}

export async function rankApplyBatchJobs(
  jobs: SimplifyGithubJobRow[],
  profile?: Partial<CandidateTargetProfile>,
  options?: {
    applyThreshold?: number;
    maxConcurrency?: number;
    snippetLoader?: (job: SimplifyGithubJobRow) => Promise<string | undefined>;
  },
): Promise<RankedApplyJob[]> {
  const resolvedProfile = getDefaultApplyBatchCandidateProfile(profile);
  const concurrency = Math.max(1, options?.maxConcurrency ?? 5);
  const ranked: RankedApplyJob[] = [];

  for (let index = 0; index < jobs.length; index += concurrency) {
    const chunk = jobs.slice(index, index + concurrency);
    const results = await Promise.all(
      chunk.map(async (job) => {
        const snippet = options?.snippetLoader ? await options.snippetLoader(job) : undefined;
        return rankApplyBatchJob(job, resolvedProfile, {
          applyThreshold: options?.applyThreshold,
          snippet,
        });
      }),
    );
    ranked.push(...results);
  }

  return ranked.sort((left, right) => {
    if (right.fitScore !== left.fitScore) return right.fitScore - left.fitScore;
    return left.roleTitle.localeCompare(right.roleTitle);
  });
}
