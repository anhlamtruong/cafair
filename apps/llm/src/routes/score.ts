/**
 * POST /api/score — Candidate Scoring via Amazon Nova (with Gemini fallback)
 *
 * Accepts candidate resume + job description, returns a structured fit assessment.
 * Does NOT update the database — the web-client persists via tRPC `scoreCandidate`.
 *
 * Provider resolution:
 *   FORCE_LLM_PROVIDER=nova   → Nova only (fail if unavailable)
 *   FORCE_LLM_PROVIDER=gemini → Gemini only
 *   FORCE_LLM_PROVIDER=auto   → Nova first, Gemini fallback (default)
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { formatPrompt } from "../lib/prompt-formatter.js";
import { generateNovaJSONWithRetry } from "../lib/nova.js";
import { generateJSONWithRetry } from "../lib/gemini.js";
import { getCachedResponse, setCachedResponse } from "../lib/redis.js";
import crypto from "crypto";

const router = Router();

// ─── Input / Output schemas ──────────────────────────────

const scoreInputSchema = z.object({
  candidateId: z.string(),
  resume: z.string().min(1, "Resume text is required"),
  jobDescription: z.string().min(1, "Job description is required"),
});

const scoreOutputSchema = z.object({
  fit_score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  risk_level: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

// ─── Cache helper ────────────────────────────────────────

function buildCacheKey(
  candidateId: string,
  resume: string,
  jobDescription: string,
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${candidateId}|${resume}|${jobDescription}`)
    .digest("hex");
  return `llm:score:${hash}`;
}

// ─── POST / ──────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = scoreInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { candidateId, resume, jobDescription } = parsed.data;

    // Check cache
    const cacheKey = buildCacheKey(candidateId, resume, jobDescription);
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      console.log(`✓ Cache hit for candidate ${candidateId}`);
      const cachedData = JSON.parse(cached);
      res.json({ success: true, candidateId, cached: true, ...cachedData });
      return;
    }

    // Build structured prompt
    const prompt = formatPrompt({
      role: "Expert technical recruiter and talent evaluator with deep knowledge of engineering roles, skill assessment, and hiring best practices",
      task: "Evaluate how well this candidate fits the given job description. Assess their strengths, identify gaps, determine risk level, and provide an overall fit score.",
      rules: [
        "Return ONLY a valid JSON object — no markdown, no backticks, no explanation",
        "fit_score must be an integer between 0 and 100",
        "strengths must be an array of 2-5 specific, evidence-based strengths from the resume",
        "gaps must be an array of 1-4 specific skill or experience gaps relative to the job description",
        'risk_level must be exactly "low", "medium", or "high"',
        "summary must be 2-3 sentences synthesizing the overall assessment",
        "Be objective and evidence-based — only cite skills/experience actually present in the resume",
      ],
      input: {
        resume,
        jobDescription,
      },
      output: {
        fit_score: "number (0-100)",
        strengths: ["string — specific skills or experience"],
        gaps: ["string — missing requirements"],
        risk_level: "low | medium | high",
        summary: "string — 2-3 sentence synthesis",
      },
      examples: [
        {
          input: {
            resume:
              "3 years Python, PyTorch, published NeurIPS paper, no industry experience",
            jobDescription:
              "ML Engineer: requires Python, PyTorch, 2+ years production ML",
          },
          output: {
            fit_score: 72,
            strengths: [
              "Strong Python and PyTorch skills",
              "Research depth with NeurIPS publication",
            ],
            gaps: ["No production ML deployment experience"],
            risk_level: "medium",
            summary:
              "Strong academic ML background with relevant framework experience. The lack of production deployment experience is a notable gap but trainable given research depth.",
          },
        },
      ],
    });

    // Determine LLM provider
    const forceProvider = (
      process.env.FORCE_LLM_PROVIDER ?? "auto"
    ).toLowerCase();
    let rawResult: unknown;
    let provider: string;

    if (forceProvider === "gemini") {
      // ── Gemini only ─────────────────────────────────────
      console.log(`→ Scoring candidate ${candidateId} via Gemini (forced)...`);
      rawResult = await generateJSONWithRetry<unknown>(prompt);
      provider = "gemini";
    } else if (forceProvider === "nova") {
      // ── Nova only ───────────────────────────────────────
      console.log(`→ Scoring candidate ${candidateId} via Nova (forced)...`);
      rawResult = await generateNovaJSONWithRetry<unknown>(prompt);
      provider = "nova";
    } else {
      // ── Auto: Nova → Gemini fallback ────────────────────
      try {
        console.log(`→ Scoring candidate ${candidateId} via Nova...`);
        rawResult = await generateNovaJSONWithRetry<unknown>(prompt);
        provider = "nova";
      } catch (novaErr) {
        console.warn(
          `⚠ Nova failed for candidate ${candidateId}, falling back to Gemini:`,
          (novaErr as Error).message,
        );
        rawResult = await generateJSONWithRetry<unknown>(prompt);
        provider = "gemini";
      }
    }

    // Validate output schema
    const validated = scoreOutputSchema.safeParse(rawResult);
    if (!validated.success) {
      console.error(
        `${provider} returned invalid schema:`,
        validated.error.flatten(),
      );
      res.status(502).json({
        error: "LLM returned invalid response schema",
        details: validated.error.flatten(),
        provider,
      });
      return;
    }

    // Cache the result (1 hour default)
    await setCachedResponse(cacheKey, JSON.stringify(validated.data));

    console.log(
      `✓ Scored candidate ${candidateId} via ${provider}: fit_score=${validated.data.fit_score}, risk=${validated.data.risk_level}`,
    );

    res.json({
      success: true,
      candidateId,
      provider,
      ...validated.data,
    });
  } catch (err) {
    console.error("❌ Score endpoint error:", err);
    res.status(500).json({
      error: "Scoring failed",
      message:
        process.env.NODE_ENV === "development"
          ? (err as Error).message
          : undefined,
    });
  }
});

export default router;
