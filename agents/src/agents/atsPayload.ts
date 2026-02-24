//  agents/src/agents/atsPayload.ts


import type { EvidenceItem, Lane, TriageResult } from "../types.ts";
import type { VerifyResult, VerifyAction } from "./verify.ts";
import type { MicroScreenResult } from "./microscreen.ts";

export type AtsStage = "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HOLD" | "REJECT";

export type AtsTaskType =
  | "FOLLOW_UP"
  | "SCHEDULE_INTERVIEW"
  | "SEND_MICRO_SCREEN"
  | "SEND_CODING_SCREEN"
  | "REQUEST_LINKEDIN"
  | "REQUEST_PORTFOLIO"
  | "REQUEST_CLARIFICATION"
  | "REVIEW_FLAG";

export interface AtsTask {
  type: AtsTaskType;
  label: string;
  priority: "Low" | "Medium" | "High";
  meta?: Record<string, string | number | boolean>;
}

export interface AtsEmailDraft {
  kind: "THANK_YOU" | "NEXT_STEPS" | "REDIRECT";
  subject: string;
  body: string;
}

export interface NovaActStepPreview {
  step: string;               // short UI label
  details?: string;           // short explanation
  status?: "Queued" | "Running" | "Success" | "Failed";
}

export interface AtsUpdatePayload {
  candidateId: string;
  roleId: string;

  stage: AtsStage;
  tags: string[];

  note: string;               // what gets pasted into ATS notes
  tasks: AtsTask[];

  emailDrafts: AtsEmailDraft[]; // recruiter can approve/send
  actPreviewSteps: NovaActStepPreview[]; // what Nova Act will do in the ATS UI

  debug?: {
    lane: Lane;
    fitScore: number;
    riskScore: number;
    microscreenOverall?: number;
  };
}

/**
 * Minimal wrapper shape for "packet-like" input.
 * If you later build candidatePacket.ts, you can pass that object directly as long as it has these fields.
 */
export interface CandidatePacketLike {
  candidateId: string;
  roleId: string;
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
  candidateName?: string;
  companyName?: string;
  roleName?: string;
}

function clip01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function laneToStage(lane: Lane, verifyRisk: number, microscreenOverall?: number): AtsStage {
  // If high risk, keep on HOLD until clarified (demo-safe)
  if (verifyRisk >= 0.65) return "HOLD";

  if (lane === "RECRUITER_NOW") {
    // If microscreen is weak, keep in SCREEN instead of INTERVIEW
    if (microscreenOverall !== undefined && microscreenOverall < 3.0) return "SCREEN";
    return "INTERVIEW";
  }
  if (lane === "QUICK_ASYNC_SCREEN") return "SCREEN";
  // Redirect lane should not auto-reject; keep HOLD/REJECT based on your demo story
  return "HOLD";
}

function evidenceKeywords(triage: TriageResult): string[] {
  // Extract keywords from evidence items if present
  const kws = (triage.evidence ?? [])
    .map((e) => e.keyword)
    .filter((k): k is string => !!k)
    .slice(0, 10);
  return uniq(kws);
}

function severityToPriority(sev: string): "Low" | "Medium" | "High" {
  if (sev === "HIGH") return "High";
  if (sev === "MEDIUM") return "Medium";
  return "Low";
}

function mapVerifyActionToTask(a: VerifyAction): AtsTask | null {
  switch (a.action) {
    case "REQUEST_LINKEDIN":
      return { type: "REQUEST_LINKEDIN", label: "Request LinkedIn profile", priority: "Medium", meta: { kind: "linkedin" } };
    case "REQUEST_PORTFOLIO":
      return { type: "REQUEST_PORTFOLIO", label: "Request portfolio/GitHub link", priority: "Medium", meta: { kind: "portfolio" } };
    case "SEND_CODE_SCREEN":
      return { type: "SEND_CODING_SCREEN", label: "Send quick coding screen", priority: "High", meta: { kind: "coding" } };
    case "ASK_FOLLOWUP":
      return { type: "REQUEST_CLARIFICATION", label: "Ask a short clarification question", priority: "High" };
    case "REQUEST_TRANSCRIPT_EXPORT":
      return { type: "REVIEW_FLAG", label: "Review transcript for verification", priority: "Medium" };
    default:
      return null;
  }
}

function buildAtsNote(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
  candidateName?: string;
  roleName?: string;
}): string {
  const { triage, verify, microscreen, candidateName, roleName } = args;

  const topEvidence = (triage.evidence ?? []).slice(0, 4).map((e) => {
    const k = e.keyword ? `Keyword: ${e.keyword}` : "";
    const q = e.quote ? `Quote: ${e.quote}` : "";
    const bits = [k, q].filter(Boolean).join(" | ");
    return bits ? `- ${e.label} (${bits})` : `- ${e.label}`;
  });

  const topFlags = verify.flags.slice(0, 3).map((f) => `- ${f.type} (${f.severity}): ${f.reason}`);

  const msLine = microscreen
    ? `Micro-screen: overall ${microscreen.overall.toFixed(2)} / 5 (confidence ${microscreen.confidence.toFixed(2)})`
    : "Micro-screen: not available";

  return [
    `FairSignal / AI Hire AI — Recruiter Note`,
    candidateName ? `Candidate: ${candidateName}` : "",
    roleName ? `Role: ${roleName}` : "",
    `Lane: ${triage.lane} | Fit: ${(triage.fitScore * 100).toFixed(0)}% | Confidence: ${(triage.confidence * 100).toFixed(0)}%`,
    `Verification risk: ${(verify.riskScore * 100).toFixed(0)}%`,
    msLine,
    ``,
    `Top evidence:`,
    ...(topEvidence.length ? topEvidence : ["- (none)"]),
    ``,
    `Flags (signals only):`,
    ...(topFlags.length ? topFlags : ["- none"]),
    ``,
    `Recommended next step: ${triage.nextActions?.[0]?.action ?? "REVIEW"}`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

function buildEmailDrafts(args: {
  packet: CandidatePacketLike;
  stage: AtsStage;
}): AtsEmailDraft[] {
  const { packet, stage } = args;
  const name = packet.candidateName ?? "there";
  const role = packet.roleName ?? "the role";

  if (stage === "INTERVIEW") {
    return [
      {
        kind: "NEXT_STEPS",
        subject: `Next steps for ${role}`,
        body:
          `Hi ${name},\n\nThanks for chatting with us at the career fair. ` +
          `We’d like to move you to the next step for ${role}. ` +
          `Please share 2–3 time windows this week that work for a short interview.\n\n` +
          `Best,\nRecruiting Team`,
      },
    ];
  }

  if (stage === "SCREEN") {
    return [
      {
        kind: "THANK_YOU",
        subject: `Thanks for your interest in ${role}`,
        body:
          `Hi ${name},\n\nThanks for stopping by our booth. ` +
          `To move forward, we’d like you to complete a quick screen (3 minutes) so we can capture a bit more signal. ` +
          `We’ll follow up with next steps shortly after.\n\n` +
          `Best,\nRecruiting Team`,
      },
    ];
  }

  return [
    {
      kind: "REDIRECT",
      subject: `Thanks for connecting at the career fair`,
      body:
        `Hi ${name},\n\nThanks for taking the time to connect with us. ` +
        `At the moment, we may not have the best match for your profile in this specific role. ` +
        `If you’re open to it, we can point you to other roles that better match your interests.\n\n` +
        `Best,\nRecruiting Team`,
    },
  ];
}

function buildNovaActPreview(args: {
  stage: AtsStage;
  tags: string[];
}): NovaActStepPreview[] {
  // Keep short for demo: 4–6 steps max
  const steps: NovaActStepPreview[] = [
    { step: "Open ATS", details: "Navigate to ATS and locate candidate", status: "Queued" },
    { step: "Update notes", details: "Paste structured recruiter note", status: "Queued" },
    { step: "Apply tags", details: `Add tags: ${args.tags.slice(0, 6).join(", ")}`, status: "Queued" },
    { step: "Move stage", details: `Set stage to ${args.stage}`, status: "Queued" },
    { step: "Create tasks", details: "Add follow-up / scheduling tasks", status: "Queued" },
  ];
  return steps;
}

/**
 * Main adapter: packet -> ATS-ready payload.
 */
export function toAtsUpdatePayload(packet: CandidatePacketLike): AtsUpdatePayload {
  const triage = packet.triage;
  const verify = packet.verify;
  const microscreen = packet.microscreen;

  const stage = laneToStage(triage.lane, verify.riskScore, microscreen?.overall);

  const kws = evidenceKeywords(triage).map((k) => `skill:${k.toLowerCase()}`);

  const tags = uniq([
    `source:career_fair`,
    `lane:${triage.lane}`,
    `fit:${Math.round(triage.fitScore * 100)}`,
    verify.riskScore >= 0.65 ? "risk:high" : verify.riskScore >= 0.35 ? "risk:medium" : "risk:low",
    ...kws.slice(0, 8),
  ]);

  // Tasks: from verification suggested actions + stage
  const tasks: AtsTask[] = [];

  // Stage-driven tasks
  if (stage === "INTERVIEW") {
    tasks.push({ type: "SCHEDULE_INTERVIEW", label: "Schedule interview", priority: "High" });
  } else if (stage === "SCREEN") {
    tasks.push({ type: "SEND_MICRO_SCREEN", label: "Send 3-minute micro-screen", priority: "High" });
  } else if (stage === "HOLD") {
    tasks.push({ type: "REVIEW_FLAG", label: "Review verification signals before advancing", priority: "High" });
  }

  // Verification-driven tasks
  for (const a of verify.suggestedActions.slice(0, 3)) {
    const t = mapVerifyActionToTask(a);
    if (t) tasks.push(t);
  }

  // Flag-specific tasks (short, 1–2)
  for (const f of verify.flags.slice(0, 2)) {
    tasks.push({
      type: "REVIEW_FLAG",
      label: `Review flag: ${f.type}`,
      priority: severityToPriority(f.severity),
    });
  }

  const note = buildAtsNote({
    triage,
    verify,
    microscreen,
    candidateName: packet.candidateName,
    roleName: packet.roleName,
  });

  const emailDrafts = buildEmailDrafts({ packet, stage });
  const actPreviewSteps = buildNovaActPreview({ stage, tags });

  return {
    candidateId: packet.candidateId,
    roleId: packet.roleId,
    stage,
    tags,
    note,
    tasks: tasks.slice(0, 8), // keep compact for demo
    emailDrafts,
    actPreviewSteps,
    debug: {
      lane: triage.lane,
      fitScore: triage.fitScore,
      riskScore: verify.riskScore,
      microscreenOverall: microscreen?.overall,
    },
  };
}