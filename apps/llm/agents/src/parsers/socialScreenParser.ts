// Path: apps/llm/agents/src/parsers/socialScreenParser.ts
//
// Normalizes model output for AI Social Intelligence / verification screening.
// Accepts raw model text and converts it to a stable internal shape for recruiter UI.

export type SocialRisk = "low" | "medium" | "high";

export interface SocialScreenParsed {
  fitScore: number;
  risk: SocialRisk;
  strengths: string[];
  concerns: string[];
  flags: string[];
  summary: string;
}

export interface SocialScreenParseResult {
  ok: boolean;
  value: SocialScreenParsed;
  parseError?: string;
  rawExtractedJson?: string;
}

const DEFAULT_VALUE: SocialScreenParsed = {
  fitScore: 80,
  risk: "low",
  strengths: [],
  concerns: [],
  flags: [],
  summary: "Social screening completed.",
};

function cleanText(text?: string): string {
  return (text ?? "").trim();
}

function uniqStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const out = items
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(out));
}

function clampScore(n: unknown): number {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return DEFAULT_VALUE.fitScore;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRisk(value: unknown): SocialRisk {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "high") return "high";
  if (v === "medium") return "medium";
  if (v === "low") return "low";

  return DEFAULT_VALUE.risk;
}

function extractJsonBlock(text: string): string | null {
  const trimmed = cleanText(text);
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return objectMatch[0].trim();
  }

  return null;
}

function safeParseObject(text: string): { parsed: any | null; error?: string } {
  try {
    return { parsed: JSON.parse(text) };
  } catch (err) {
    return {
      parsed: null,
      error: err instanceof Error ? err.message : "JSON parse failed",
    };
  }
}

export function parseSocialScreenText(
  text: string
): SocialScreenParseResult {
  const extracted = extractJsonBlock(text);

  if (!extracted) {
    return {
      ok: false,
      value: DEFAULT_VALUE,
      parseError: "No JSON object found in model output.",
    };
  }

  const { parsed, error } = safeParseObject(extracted);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      value: DEFAULT_VALUE,
      parseError: error ?? "Parsed value is not an object.",
      rawExtractedJson: extracted,
    };
  }

  const value: SocialScreenParsed = {
    fitScore: clampScore(parsed.fitScore),
    risk: normalizeRisk(parsed.risk),
    strengths: uniqStrings(parsed.strengths),
    concerns: uniqStrings(parsed.concerns),
    flags: uniqStrings(parsed.flags),
    summary: cleanText(parsed.summary) || DEFAULT_VALUE.summary,
  };

  return {
    ok: true,
    value,
    rawExtractedJson: extracted,
  };
}