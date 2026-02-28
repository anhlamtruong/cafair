// Path: agents/src/prompts/socialScreen.ts
//
// Prompt builders for AI Social Intelligence / verification-style screening.
// Used when you want to compare public signals (LinkedIn, GitHub, Google)
// against resume / self-reported claims.

export const SOCIAL_SCREEN_PROMPT_VERSION = "social_screen_v1";

export interface SocialScreenPromptInput {
  candidateName: string;
  roleTitle: string;
  companyName?: string;
  resumeText: string;
  linkedinSummary?: string;
  githubSummary?: string;
  googleSummary?: string;
  conversationSummary?: string;
}

export interface PromptBundle {
  version: string;
  feature: string;
  system: string;
  prompt: string;
  schemaHint: string;
}

function cleanBlock(text?: string): string {
  return (text ?? "").trim();
}

export function buildSocialScreenPrompt(
  input: SocialScreenPromptInput
): PromptBundle {
  const system = [
    "You are an AI social intelligence assistant for recruiters.",
    "Compare resume claims with public professional signals from LinkedIn, GitHub, and Google summaries.",
    "Identify alignment, mismatches, and verification risk carefully.",
    "Do not make definitive accusations.",
    "Return strict JSON only.",
  ].join(" ");

  const schemaHint = JSON.stringify(
    {
      fitScore: 0,
      risk: "low | medium | high",
      strengths: ["string"],
      concerns: ["string"],
      flags: ["string"],
      summary: "string",
    },
    null,
    2
  );

  const prompt = [
    `Prompt Version: ${SOCIAL_SCREEN_PROMPT_VERSION}`,
    `Candidate Name: ${input.candidateName}`,
    `Role Title: ${input.roleTitle}`,
    `Company: ${input.companyName ?? "N/A"}`,
    "",
    "Resume:",
    cleanBlock(input.resumeText) || "N/A",
    "",
    "LinkedIn Summary:",
    cleanBlock(input.linkedinSummary) || "N/A",
    "",
    "GitHub Summary:",
    cleanBlock(input.githubSummary) || "N/A",
    "",
    "Google / Web Summary:",
    cleanBlock(input.googleSummary) || "N/A",
    "",
    "Career Fair / Conversation Summary:",
    cleanBlock(input.conversationSummary) || "N/A",
    "",
    "Task:",
    "- Estimate fit from 0 to 100 using the combined evidence.",
    "- Assess verification risk as low, medium, or high.",
    "- List strengths supported by multiple sources when possible.",
    "- List concerns or mismatches.",
    "- List non-accusatory flags worth recruiter review.",
    "- Write a short final summary.",
    "",
    "Return ONLY valid JSON matching this schema:",
    schemaHint,
  ].join("\n");

  return {
    version: SOCIAL_SCREEN_PROMPT_VERSION,
    feature: "social_screen",
    system,
    prompt,
    schemaHint,
  };
}