/**
 * Prompt Templates Registry
 *
 * Pre-built, optimized prompt templates for common AI tasks.
 * Each template returns a formatted prompt string ready for the LLM.
 */

import { createPromptTemplate } from "./prompt-formatter.js";

// ============================================================================
// Theme Generation
// ============================================================================

export const generateThemePalette = createPromptTemplate({
  role: "Expert UI/UX designer specializing in color theory and design systems",
  task: "Generate a cohesive, accessible color palette for a web application theme",
  rules: [
    "Return ONLY valid JSON — no markdown, no explanation",
    "All colors must be valid hex color codes",
    "Ensure primary/foreground pairs meet WCAG AA contrast ratio (4.5:1)",
    "Destructive color must clearly communicate danger/error",
    "Muted colors should be subtle variations of the background",
    "Chart colors must be visually distinguishable from each other",
    "Dark mode should maintain the same hue family but adjust lightness",
  ],
  output: {
    light: {
      background: "#hex",
      foreground: "#hex",
      primary: "#hex",
      "primary-foreground": "#hex",
      secondary: "#hex",
      "secondary-foreground": "#hex",
      muted: "#hex",
      "muted-foreground": "#hex",
      accent: "#hex",
      "accent-foreground": "#hex",
      destructive: "#hex",
      border: "#hex",
    },
    dark: {
      background: "#hex",
      foreground: "#hex",
      primary: "#hex",
      "primary-foreground": "#hex",
      "...": "same shape as light",
    },
  },
  examples: [
    {
      input: { mood: "calm", baseColor: "#3b82f6" },
      output: {
        light: {
          background: "#f8fafc",
          foreground: "#1e293b",
          primary: "#3b82f6",
          "primary-foreground": "#ffffff",
        },
        dark: {
          background: "#0f172a",
          foreground: "#e2e8f0",
          primary: "#60a5fa",
          "primary-foreground": "#0f172a",
        },
      },
    },
  ],
});

// ============================================================================
// Text Summarization
// ============================================================================

export const summarizeText = createPromptTemplate({
  role: "Expert content analyst with strong summarization skills",
  task: "Produce a concise, accurate summary of the provided text",
  rules: [
    "Return ONLY valid JSON — no markdown, no explanation",
    "Summary must be shorter than the original text",
    "Preserve the key facts, names, and numbers",
    "Use clear, simple language",
    "Include a list of key takeaways",
    "Identify the overall sentiment",
  ],
  output: {
    summary: "string — concise summary paragraph",
    keyTakeaways: ["string — bullet point 1", "string — bullet point 2"],
    sentiment: "positive | neutral | negative",
    wordCount: "number — word count of summary",
  },
});

// ============================================================================
// Code Review
// ============================================================================

export const reviewCode = createPromptTemplate({
  role: "Senior software engineer and code reviewer",
  task: "Analyze the provided code and give actionable review feedback",
  rules: [
    "Return ONLY valid JSON — no markdown, no explanation",
    "Focus on bugs, security issues, performance, and readability",
    "Assign a severity to each issue: critical, warning, or suggestion",
    "Provide a brief fix recommendation for each issue",
    "If the code is good, return an empty issues array with a positive comment",
  ],
  output: {
    overallScore: "number 1-10",
    summary: "string — one sentence overview",
    issues: [
      {
        severity: "critical | warning | suggestion",
        line: "number | null",
        description: "string",
        fix: "string",
      },
    ],
  },
});

// ============================================================================
// Content Rewriting
// ============================================================================

export const rewriteContent = createPromptTemplate({
  role: "Professional content writer and editor",
  task: "Rewrite the provided text according to the specified tone and constraints",
  rules: [
    "Return ONLY valid JSON — no markdown, no explanation",
    "Preserve the original meaning and key information",
    "Match the requested tone precisely",
    "Keep approximately the same length unless told otherwise",
    "Fix any grammar or spelling errors in the original",
  ],
  output: {
    rewritten: "string — the rewritten text",
    changes: ["string — brief description of each change made"],
    tone: "string — the tone applied",
  },
});

// ============================================================================
// Data Extraction
// ============================================================================

export const extractStructuredData = createPromptTemplate({
  role: "Data extraction specialist",
  task: "Extract structured data from unstructured text into the requested schema",
  rules: [
    "Return ONLY valid JSON — no markdown, no explanation",
    "Only extract information that is explicitly present in the text",
    "Use null for fields where data cannot be found",
    "Do not infer or hallucinate data",
    "Normalize dates to ISO 8601 format when possible",
  ],
  output: "{ ...schema provided in input.outputSchema }",
});

// ============================================================================
// Translation
// ============================================================================

export const translateText = createPromptTemplate({
  role: "Professional translator with expertise in technical and casual content",
  task: "Translate the provided text to the target language",
  rules: [
    "Return ONLY valid JSON — no markdown, no explanation",
    "Preserve formatting, tone, and intent of the original",
    "Keep technical terms in their commonly accepted form in the target language",
    "If a term has no good translation, keep it in the original language with a note",
  ],
  output: {
    translated: "string — the translated text",
    sourceLanguage: "string — detected source language",
    targetLanguage: "string — target language",
    notes: ["string — any translation notes or untranslatable terms"],
  },
});

// ============================================================================
// Template Registry — for dynamic lookup by name
// ============================================================================

export const PROMPT_TEMPLATES = {
  "generate-theme-palette": generateThemePalette,
  "summarize-text": summarizeText,
  "review-code": reviewCode,
  "rewrite-content": rewriteContent,
  "extract-structured-data": extractStructuredData,
  "translate-text": translateText,
} as const;

export type TemplateName = keyof typeof PROMPT_TEMPLATES;

export const AVAILABLE_TEMPLATES = Object.keys(
  PROMPT_TEMPLATES,
) as TemplateName[];
