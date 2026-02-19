/**
 * Prompt Formatter — Deterministic structured prompt builder
 *
 * Builds reproducible, well-structured prompts for LLM interactions.
 * Every prompt follows the same layout so the AI always gets clear instructions.
 */

// ============================================================================
// Types
// ============================================================================

export type PromptFormatterArgs = {
  /** The persona the AI should adopt */
  role: string;
  /** What the AI should accomplish */
  task: string;
  /** Constraints the AI must follow */
  rules: string[];
  /** Structured input data */
  input: Record<string, unknown>;
  /** Expected output shape (JSON schema or description) */
  output: Record<string, unknown> | string;
  /** Additional context the AI needs */
  context?: Record<string, unknown>;
  /** Optional examples of input → output */
  examples?: Array<{ input: Record<string, unknown>; output: unknown }>;
};

// ============================================================================
// Helpers
// ============================================================================

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// ============================================================================
// Core Formatter
// ============================================================================

/**
 * Formats a deterministic prompt with role, task, input, rules, and output.
 *
 * @example
 * ```ts
 * formatPrompt({
 *   role: "Expert color analyst",
 *   task: "Generate a cohesive color palette",
 *   rules: ["Return valid hex codes", "Ensure WCAG AA contrast"],
 *   input: { baseColor: "#3b82f6", count: 5 },
 *   output: { colors: ["#hex1", "#hex2", "..."] },
 * });
 * ```
 */
export function formatPrompt({
  role,
  task,
  rules,
  input,
  output,
  context,
  examples,
}: PromptFormatterArgs): string {
  const sections: string[] = [
    `Role: ${role}`,
    `Task: ${task}`,
    "",
    "Input (JSON):",
    prettyJson(input),
  ];

  if (context && Object.keys(context).length > 0) {
    sections.push("", "Context (JSON):", prettyJson(context));
  }

  if (rules.length > 0) {
    sections.push("", "Rules:", ...rules.map((rule) => `- ${rule}`));
  }

  if (examples && examples.length > 0) {
    sections.push("", "Examples:");
    examples.forEach((example, i) => {
      sections.push(
        `  Example ${i + 1}:`,
        `    Input: ${prettyJson(example.input)}`,
        `    Output: ${prettyJson(example.output)}`,
      );
    });
  }

  sections.push(
    "",
    "Output (JSON):",
    typeof output === "string" ? output : prettyJson(output),
  );

  return sections.join("\n").trim();
}

/**
 * Create a reusable prompt template with fixed role/task/rules.
 * Only `input` and optionally `context` change per call.
 */
export function createPromptTemplate(
  template: Omit<PromptFormatterArgs, "input" | "context">,
) {
  return (input: Record<string, unknown>, context?: Record<string, unknown>) =>
    formatPrompt({ ...template, input, context });
}
