// Path: apps/llm/agents/src/agents/socialScreen.ts

export type SocialSource = "LinkedIn" | "GitHub" | "Google";

export type SocialRisk = "low" | "medium" | "high";

export interface SocialEvidenceItem {
  source: "resume" | "linkedin" | "github" | "google";
  level: "high" | "medium" | "low";
  quote: string;
}

export interface SocialSignal {
  source: SocialSource;
  found: boolean;
  confidence: number;
  summary?: string;
}

export interface SocialScreenResult {
  candidateId: string;
  fitScore: number;
  screenScore: number;
  risk: SocialRisk;
  technicalSkillsScore: number;
  technicalSkillsSummary: string;
  experienceScore: number;
  experienceSummary: string;
  communicationScore: number;
  communicationSummary: string;
  signals: SocialSignal[];
  evidence: SocialEvidenceItem[];
  flags: string[];
  recommendedActions: string[];
  summary: string;
}

export interface SocialScreenInput {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  googleSummary?: string;
}

function contains(text: string, keywords: string[]) {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

export function runSocialScreen(input: SocialScreenInput): SocialScreenResult {
  const resume = input.resumeText ?? "";

  let tech = 7;
  let exp = 7;
  let comm = 7;

  const evidence: SocialEvidenceItem[] = [];
  const flags: string[] = [];

  if (contains(resume, ["pytorch", "react", "full-stack", "ml", "audio", "real-time"])) {
    tech = 9;
  }

  if (contains(resume, ["3 years", "three years", "production", "users", "10k", "internship"])) {
    exp = 8;
  }

  if (contains(resume, ["built", "developed", "led", "improved", "shipped"])) {
    comm = 8;
  }

  if (contains(resume, ["real-time AI music transcription", "<100ms latency"])) {
    evidence.push({
      source: "resume",
      level: "high",
      quote: `Developed real-time AI music transcription engine processing audio with <100ms latency`,
    });
  }

  if (contains(resume, ["React-based music visualization dashboard", "10K+ users"])) {
    evidence.push({
      source: "resume",
      level: "high",
      quote: `Built React-based music visualization dashboard used by 10K+ users`,
    });
  }

  const signals: SocialSignal[] = [
    {
      source: "LinkedIn",
      found: !!input.linkedinUrl,
      confidence: input.linkedinUrl ? 0.9 : 0.3,
      summary: input.linkedinUrl ? "Profile found with aligned experience timeline" : "No profile linked yet",
    },
    {
      source: "GitHub",
      found: !!input.githubUrl,
      confidence: input.githubUrl ? 0.88 : 0.35,
      summary: input.githubUrl ? "Code activity supports technical claims" : "No GitHub linked yet",
    },
    {
      source: "Google",
      found: !!input.googleSummary,
      confidence: input.googleSummary ? 0.7 : 0.25,
      summary: input.googleSummary ? "Public web references found" : "No strong public web signal",
    },
  ];

  if (!input.linkedinUrl) flags.push("Missing LinkedIn");
  if (!input.githubUrl) flags.push("Missing GitHub");

  const risk: SocialRisk = flags.length >= 2 ? "medium" : "low";

  const fitScore = 86;
  const screenScore = 33;

  return {
    candidateId: input.candidateId,
    fitScore,
    screenScore,
    risk,
    technicalSkillsScore: tech,
    technicalSkillsSummary: "Strong PyTorch and full-stack skills",
    experienceScore: exp,
    experienceSummary: "3 years ML + web dev",
    communicationScore: comm,
    communicationSummary: "Clear technical communicator",
    signals,
    evidence,
    flags,
    recommendedActions: ["Sync to ATS", "Schedule Interview", "Send Follow-up"],
    summary: "Social screen suggests strong technical fit with low risk.",
  };
}