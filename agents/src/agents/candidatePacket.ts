// Path: agents/src/agents/candidatePacket.ts
//
// Candidate Packet Orchestrator (demo-ready).
// Combines triage + verify + microscreen into ONE payload that both
// the candidate-side and recruiter-side UI can render.
//
// Uses your existing agents:
// - runTriage (from triage.ts)
// - runVerify (from verify.ts)
// - runMicroScreen (from microscreen.ts)
//
// Notes:
// - No external calls yet (stub-first). Later you can swap internals to Nova 2 Lite / embeddings / Sonic.
// - Includes "primary CTA" + "prompt card" for recruiter conversations.
// - Keeps output compact for demo.

import type { RoleProfile, TriageRequest, TriageResult, Lane } from "../types.ts";
import { runTriage } from "./triage.ts";
import { runVerify, type VerifyResult } from "./verify.ts";
import { runMicroScreen, type MicroScreenResult } from "./microscreen.ts";

export type PersonaSide = "candidate" | "recruiter";

export interface RecruiterPromptCard {
  // small card shown before conversation
  whatWeKnow: string[];      // 2–4 bullets
  whatToAsk: string[];       // 2–4 bullets
  whatToVerify: string[];    // 1–3 bullets
  redFlags: string[];        // 0–2 bullets
}

export interface PrimaryCTA {
  label: string;
  action:
    | "OPEN_CHAT"
    | "SEND_MICRO_SCREEN"
    | "REQUEST_LINKEDIN"
    | "REQUEST_PORTFOLIO"
    | "SEND_CODING_SCREEN"
    | "SYNC_TO_ATS"
    | "REDIRECT";
  reason: string;
}

export interface CandidatePacketResult {
  candidateId: string;
  roleId: string;

  candidateName?: string;
  roleName?: string;
  companyName?: string; // optional for demo

  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;

  promptCard: RecruiterPromptCard;
  primaryCTA: PrimaryCTA;

  highlights: string[];     // quick UI bullets (top evidence / quotes)
  nextSteps: string[];      // short list of recommended actions

  summary: string;
  createdAtISO: string;

  debug?: {
    transcriptLen: number;
    resumeLen: number;
    essayLen: number;
    usedMicroScreen: boolean;
  };
}

function clip01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function shortPct(x: number) {
  return `${Math.round(clip01(x) * 100)}%`;
}

function laneLabel(lane: Lane) {
  if (lane === "RECRUITER_NOW") return "Recruiter Now";
  if (lane === "QUICK_ASYNC_SCREEN") return "Quick Screen";
  return "Redirect";
}

function pickPrimaryCTA(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
  side?: PersonaSide;
}): PrimaryCTA {
  const side = args.side ?? "recruiter";

  // If high risk, default to verify actions first
  if (args.verify.riskScore >= 0.65) {
    const first = args.verify.suggestedActions[0]?.action;
    if (first === "REQUEST_LINKEDIN") {
      return { label: "Request LinkedIn", action: "REQUEST_LINKEDIN", reason: "High verification risk; confirm timeline." };
    }
    if (first === "REQUEST_PORTFOLIO") {
      return { label: "Request Portfolio", action: "REQUEST_PORTFOLIO", reason: "High risk; request proof artifacts." };
    }
    if (first === "SEND_CODE_SCREEN") {
      return { label: "Send Coding Screen", action: "SEND_CODING_SCREEN", reason: "High risk; verify skill quickly." };
    }
    return { label: "Open Chat (Verify)", action: "OPEN_CHAT", reason: "High risk; ask a short clarification question." };
  }

  // Lane-based CTA
  if (args.triage.lane === "RECRUITER_NOW") {
    // recruiter side: chat; candidate side: join booth/chat
    return {
      label: side === "candidate" ? "Join Recruiter Chat" : "Open Chat",
      action: "OPEN_CHAT",
      reason: "Strong fit; proceed with recruiter conversation.",
    };
  }

  if (args.triage.lane === "QUICK_ASYNC_SCREEN") {
    return {
      label: side === "candidate" ? "Take 3-min Screen" : "Send 3-min Screen",
      action: "SEND_MICRO_SCREEN",
      reason: "Needs quick signal before spending recruiter time.",
    };
  }

  return {
    label: side === "candidate" ? "Explore Other Roles" : "Redirect",
    action: "REDIRECT",
    reason: "Not a fit for this role; provide alternatives.",
  };
}

function buildHighlights(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}): string[] {
  const hi: string[] = [];

  hi.push(`Fit ${shortPct(args.triage.fitScore)} • ${laneLabel(args.triage.lane)}`);
  hi.push(`Risk ${shortPct(args.verify.riskScore)} • ${args.verify.flags.length} flags`);

  // Pull a few evidence items
  const ev = (args.triage.evidence ?? []).slice(0, 3).map((e) => {
    if (e.keyword) return `Evidence: ${e.keyword}`;
    if (e.quote) return `Evidence: ${e.quote}`;
    return `Evidence: ${e.label}`;
  });
  hi.push(...ev);

  // Micro-screen highlights
  if (args.microscreen?.highlights?.length) {
    hi.push(`Micro-screen: ${args.microscreen.overall.toFixed(2)}/5`);
    hi.push(...args.microscreen.highlights.slice(0, 2).map((s) => `Quote: ${s}`));
  }

  return uniq(hi).slice(0, 6);
}

function buildNextSteps(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}): string[] {
  const steps: string[] = [];

  // Lane recommendation
  if (args.triage.lane === "RECRUITER_NOW") steps.push("Proceed to recruiter conversation");
  if (args.triage.lane === "QUICK_ASYNC_SCREEN") steps.push("Complete 3-min micro-screen");
  if (args.triage.lane === "POLITE_REDIRECT") steps.push("Redirect to better-fit roles/resources");

  // Verification recommendations
  if (args.verify.riskScore >= 0.35) {
    steps.push("Verify key claims with one quick follow-up");
  }

  // Micro-screen followups
  if (args.microscreen?.followups?.length) {
    steps.push(...args.microscreen.followups.slice(0, 2));
  }

  // Suggested actions (short)
  for (const a of args.verify.suggestedActions.slice(0, 2)) {
    steps.push(a.label);
  }

  return uniq(steps).slice(0, 6);
}

function buildPromptCard(args: {
  role: RoleProfile;
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}): RecruiterPromptCard {
  const must = args.role.mustHaveKeywords ?? [];
  const nice = args.role.niceToHaveKeywords ?? [];

  const whatWeKnow: string[] = [
    `Lane: ${laneLabel(args.triage.lane)} • Fit ${shortPct(args.triage.fitScore)}`,
    `Risk: ${shortPct(args.verify.riskScore)}`,
  ];

  // quick evidence keywords
  const kws = (args.triage.evidence ?? [])
    .map((e) => e.keyword)
    .filter((k): k is string => !!k)
    .slice(0, 4);

  if (kws.length) whatWeKnow.push(`Signals: ${kws.join(", ")}`);

  const whatToAsk: string[] = [];
  if (must.length) whatToAsk.push(`Ask for proof on: ${must.slice(0, 2).join(", ")}`);
  whatToAsk.push("Ask for one shipped project and measurable impact");

  const whatToVerify: string[] = [];
  if (args.verify.flags.length) whatToVerify.push("Clarify mismatched claims (timeline/experience)");
  if (args.verify.riskScore >= 0.35) whatToVerify.push("Request LinkedIn/portfolio link");

  const redFlags: string[] = [];
  for (const f of args.verify.flags.slice(0, 2)) {
    redFlags.push(`${f.type}: ${f.reason}`);
  }
  if (args.microscreen?.redFlags?.length) redFlags.push(...args.microscreen.redFlags.slice(0, 1));

  return {
    whatWeKnow: uniq(whatWeKnow).slice(0, 4),
    whatToAsk: uniq(whatToAsk).slice(0, 4),
    whatToVerify: uniq(whatToVerify).slice(0, 3),
    redFlags: uniq(redFlags).slice(0, 2),
  };
}

/**
 * Main orchestrator.
 * Input is the same shape as runTriage() request (TriageRequest), plus a few optional fields.
 */
export function buildCandidatePacket(args: TriageRequest & {
  roleName?: string;
  companyName?: string;
  side?: PersonaSide;              // affects CTA labels
  enableMicroScreen?: boolean;     // default true
  microScreenMinChars?: number;    // default 40
}): CandidatePacketResult {
  const createdAtISO = new Date().toISOString();

  const triage = runTriage(args);

  const verify = runVerify({
    candidateId: args.candidateId,
    roleId: args.role.roleId,
    roleName: args.roleName ?? args.role.roleName,
    mustHaveKeywords: args.role.mustHaveKeywords ?? [],
    artifacts: args.artifacts,
  });

  const enableMicro = args.enableMicroScreen ?? true;
  const minChars = args.microScreenMinChars ?? 40;
  const transcript = (args.artifacts.transcriptText ?? "").trim();

  const microscreen =
    enableMicro && transcript.length >= minChars
      ? runMicroScreen({
          candidateId: args.candidateId,
          roleId: args.role.roleId,
          roleName: args.roleName ?? args.role.roleName,
          mustHaveKeywords: args.role.mustHaveKeywords ?? [],
          responseTranscriptText: transcript,
        })
      : undefined;

  const promptCard = buildPromptCard({ role: args.role, triage, verify, microscreen });

  const primaryCTA = pickPrimaryCTA({
    triage,
    verify,
    microscreen,
    side: args.side ?? "recruiter",
  });

  const highlights = buildHighlights({ triage, verify, microscreen });
  const nextSteps = buildNextSteps({ triage, verify, microscreen });

  const summary =
    `Fit ${shortPct(triage.fitScore)} (${laneLabel(triage.lane)}), ` +
    `Risk ${shortPct(verify.riskScore)}. ` +
    (microscreen ? `Micro-screen ${microscreen.overall.toFixed(2)}/5.` : `No micro-screen yet.`);

  return {
    candidateId: args.candidateId,
    roleId: args.role.roleId,
    candidateName: args.candidateName,
    roleName: args.roleName ?? args.role.roleName,
    companyName: args.companyName,
    triage,
    verify,
    microscreen,
    promptCard,
    primaryCTA,
    highlights,
    nextSteps,
    summary,
    createdAtISO,
    debug: {
      transcriptLen: (args.artifacts.transcriptText ?? "").length,
      resumeLen: (args.artifacts.resumeText ?? "").length,
      essayLen: (args.artifacts.essayText ?? "").length,
      usedMicroScreen: !!microscreen,
    },
  };
}