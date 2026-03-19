/**
 * Resume Parser — Orchestrator
 *
 * 1. Calls the LLM microservice (Bedrock Nova) at LLM_SERVICE_URL/api/parse-resume
 * 2. Falls back to Gemini SDK directly if the LLM service is unavailable
 * 3. Validates the response against parsedResumeSchema
 *
 * Returns a strongly-typed ParsedResume or throws.
 */

import { parsedResumeSchema, type ParsedResume } from "./schema";

/* ── Constants ───────────────────────────────────────────────────────── */

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL ?? "http://localhost:3001";

const PARSE_SYSTEM_PROMPT = `You are a resume parsing AI. Given the full text of a candidate's resume, extract structured data and return ONLY valid JSON with no markdown formatting, no backticks, no explanation.

Return this exact JSON shape:
{
  "summary": {
    "roleTitle": "their most recent/primary job title",
    "aiSummary": "a 2-3 sentence professional summary"
  },
  "experiences": [
    {
      "company": "Company Name",
      "roleTitle": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null if current",
      "isCurrent": false,
      "description": "Brief description of responsibilities and achievements"
    }
  ],
  "skills": [
    { "name": "Skill Name", "category": "optional category like Frontend, Backend, etc." }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Type",
      "fieldOfStudy": "Field",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "issueDate": "YYYY-MM",
      "expiryDate": "YYYY-MM or null"
    }
  ],
  "roleTargets": [
    { "roleTitle": "Target Role Title" }
  ]
}

Rules:
- Extract ALL work experiences found in the resume
- Extract ALL skills mentioned (technical and soft skills)
- If a section has no data, return an empty array
- Dates should be in YYYY-MM format when possible
- For roleTargets, infer 1-3 likely target roles based on the candidate's experience
- Return ONLY the JSON object, nothing else`;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function safeParseJson(text: string): unknown {
  const cleaned = stripMarkdownFences(text);
  return JSON.parse(cleaned);
}

/* ── LLM Service Call (primary) ──────────────────────────────────────── */

async function callLlmService(resumeText: string): Promise<ParsedResume> {
  const url = `${LLM_SERVICE_URL}/api/parse-resume`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText }),
    signal: AbortSignal.timeout(30_000), // 30 s timeout
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM service returned ${res.status}: ${body}`);
  }

  const json = await res.json();
  // The LLM service may wrap the result in a `data` field or return it directly
  const payload = json.data ?? json;
  return parsedResumeSchema.parse(payload);
}

/* ── Gemini Fallback (direct SDK call) ───────────────────────────────── */

async function callGeminiFallback(resumeText: string): Promise<ParsedResume> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set — cannot use Gemini fallback");
  }

  // Dynamic import to avoid bundling @google/generative-ai when not needed
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const prompt = `${PARSE_SYSTEM_PROMPT}\n\n--- RESUME TEXT ---\n${resumeText}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = safeParseJson(text);
  return parsedResumeSchema.parse(parsed);
}

/* ── Public API ──────────────────────────────────────────────────────── */

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  // Primary: LLM microservice (Bedrock Nova)
  try {
    console.log("[resume-parser] Trying LLM service...");
    const result = await callLlmService(resumeText);
    console.log("[resume-parser] LLM service succeeded");
    return result;
  } catch (llmError) {
    console.warn(
      "[resume-parser] LLM service failed, falling back to Gemini:",
      llmError instanceof Error ? llmError.message : llmError,
    );
  }

  // Fallback: Gemini direct
  try {
    console.log("[resume-parser] Trying Gemini fallback...");
    const result = await callGeminiFallback(resumeText);
    console.log("[resume-parser] Gemini fallback succeeded");
    return result;
  } catch (geminiError) {
    console.error(
      "[resume-parser] Gemini fallback also failed:",
      geminiError instanceof Error ? geminiError.message : geminiError,
    );
    throw new Error(
      `Resume parsing failed with all providers. Last error: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
    );
  }
}
