/**
 * Gemini AI Client
 *
 * Thin wrapper around Google's Generative AI SDK.
 * Supports text-only and multimodal (image + text) prompts.
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  type Part,
  type InlineDataPart,
} from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

const DEFAULT_JSON_RETRIES = 3;
const RETRY_BASE_MS = 1000;

export function getGeminiModel(): GenerativeModel {
  if (model) return model;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });

  return model;
}

// ============================================================================
// Image helpers
// ============================================================================

export type ImageInput = {
  /** Base64-encoded image data (no data: prefix) */
  base64: string;
  /** MIME type, e.g. "image/jpeg", "image/png", "image/webp" */
  mimeType: string;
};

/** Convert an ImageInput into a Gemini InlineDataPart */
function toInlineData(img: ImageInput): InlineDataPart {
  return {
    inlineData: {
      data: img.base64,
      mimeType: img.mimeType,
    },
  };
}

// ============================================================================
// Text-only generation
// ============================================================================

/**
 * Send a formatted prompt to Gemini and return the raw text response.
 */
export async function generateFromPrompt(prompt: string): Promise<string> {
  const gemini = getGeminiModel();
  const result = await gemini.generateContent(prompt);
  return result.response.text();
}

/**
 * Send a prompt and attempt to parse the response as JSON.
 * Strips markdown fences if the model wraps the output.
 */
export async function generateJSON<T = unknown>(prompt: string): Promise<T> {
  const raw = await generateFromPrompt(prompt);
  return parseJsonResponse<T>(raw);
}

// ============================================================================
// Multimodal generation (images + text)
// ============================================================================

/**
 * Send images + a text prompt to Gemini for multimodal analysis.
 * Returns the raw text response.
 */
export async function generateFromMultimodal(
  prompt: string,
  images: ImageInput[],
): Promise<string> {
  const gemini = getGeminiModel();
  const parts: Part[] = [...images.map(toInlineData), { text: prompt }];
  const result = await gemini.generateContent(parts);
  return result.response.text();
}

/**
 * Send images + text and parse the response as JSON.
 * Includes retry logic with exponential backoff for robustness.
 */
export async function generateMultimodalJSON<T = unknown>(
  prompt: string,
  images: ImageInput[],
  retries = DEFAULT_JSON_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const adjustedPrompt =
        attempt === 0 ? prompt : buildRetryPrompt(prompt, lastError, attempt);

      const raw = await generateFromMultimodal(adjustedPrompt, images);
      return parseJsonResponse<T>(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await sleep(RETRY_BASE_MS * (attempt + 1));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// JSON generation with retry (text-only)
// ============================================================================

/**
 * Generate JSON from a text prompt with retry logic.
 */
export async function generateJSONWithRetry<T = unknown>(
  prompt: string,
  retries = DEFAULT_JSON_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const adjustedPrompt =
        attempt === 0 ? prompt : buildRetryPrompt(prompt, lastError, attempt);

      const raw = await generateFromPrompt(adjustedPrompt);
      return parseJsonResponse<T>(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await sleep(RETRY_BASE_MS * (attempt + 1));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Shared helpers
// ============================================================================

/** Strip markdown fences and parse JSON */
function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const extracted = extractJsonCandidate(cleaned);

  try {
    return JSON.parse(extracted) as T;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new SyntaxError(
      `Invalid JSON response from Gemini: ${message}. Raw length=${cleaned.length}`,
    );
  }
}

function extractJsonCandidate(text: string): string {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");

  let start = -1;
  if (objectStart === -1) start = arrayStart;
  else if (arrayStart === -1) start = objectStart;
  else start = Math.min(objectStart, arrayStart);

  if (start === -1) return text;

  const objectEnd = text.lastIndexOf("}");
  const arrayEnd = text.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);

  if (end <= start) return text.slice(start);

  return text.slice(start, end + 1).trim();
}

function buildRetryPrompt(
  prompt: string,
  lastError: Error | null,
  attempt: number,
): string {
  const reason = lastError?.message ?? "Invalid JSON";

  return `${prompt}\n\nRETRY #${attempt}: The previous output could not be parsed as JSON (${reason}). Regenerate the FULL response from scratch as ONE complete valid JSON object. Do not include markdown fences or commentary. Keep string values concise and avoid unnecessary verbosity.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
