// Path: apps/llm/agents/src/schemas/candidateScreenSchema.ts
//
// Shared schema + validation helpers for recruiter-side candidate screening.
// This is useful when you want a stronger, production-style validation layer
// after Bedrock / Nova responses.
//
// If zod is installed in your repo, this file uses it.
// If not, a lightweight manual validator is also provided.
//
// Install (recommended):
//   npm install zod

import { z } from "zod";

export const CandidateScreenRecommendationEnum = z.enum([
  "INTERVIEW",
  "SCREEN",
  "HOLD",
  "REJECT",
]);

export const CandidateScreenSchema = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1),
  recommendation: CandidateScreenRecommendationEnum,
});

export type CandidateScreenSchemaType = z.infer<typeof CandidateScreenSchema>;

export const CandidateScreenSchemaWithMeta = z.object({
  candidateId: z.string().min(1),
  modelId: z.string().min(1).optional(),
  provider: z.enum(["stub", "bedrock-converse", "bedrock-invoke"]).optional(),
  degraded: z.boolean().optional(),
  usedFallback: z.boolean().optional(),
  result: CandidateScreenSchema,
});

export type CandidateScreenSchemaWithMetaType = z.infer<
  typeof CandidateScreenSchemaWithMeta
>;

export function validateCandidateScreen(
  input: unknown
): {
  ok: true;
  data: CandidateScreenSchemaType;
} | {
  ok: false;
  errors: string[];
} {
  const parsed = CandidateScreenSchema.safeParse(input);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    }),
  };
}

export function validateCandidateScreenWithMeta(
  input: unknown
): {
  ok: true;
  data: CandidateScreenSchemaWithMetaType;
} | {
  ok: false;
  errors: string[];
} {
  const parsed = CandidateScreenSchemaWithMeta.safeParse(input);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    }),
  };
}

// Optional manual normalization helper
// Useful if model output is close-but-not-perfect and you want a safe fallback path.
export function normalizeCandidateScreenLoose(input: any): CandidateScreenSchemaType {
  const rawScore =
    typeof input?.score === "number" ? input.score : Number(input?.score);

  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 75;

  const strengths = Array.isArray(input?.strengths)
    ? input.strengths
        .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean)
    : [];

  const concerns = Array.isArray(input?.concerns)
    ? input.concerns
        .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean)
    : [];

  const summary =
    typeof input?.summary === "string" && input.summary.trim()
      ? input.summary.trim()
      : "Candidate screening completed.";

  const recommendationRaw =
    typeof input?.recommendation === "string"
      ? input.recommendation.trim().toUpperCase()
      : "";

  const recommendation: CandidateScreenSchemaType["recommendation"] =
    recommendationRaw === "INTERVIEW" ||
    recommendationRaw === "SCREEN" ||
    recommendationRaw === "HOLD" ||
    recommendationRaw === "REJECT"
      ? recommendationRaw
      : "SCREEN";

  return {
    score,
    strengths,
    concerns,
    summary,
    recommendation,
  };
}