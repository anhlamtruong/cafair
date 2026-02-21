// agents/src/agents/atsPayload.ts

import type { CandidateArtifactBundle, CandidateProfile, RoleProfile } from "../types.ts";
import type { CandidatePacketResult } from "./candidatePacket.ts";

export type AtsStage = "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "REJECT" | "HOLD";

export interface AtsTask {
  type: "FOLLOW_UP" | "SCHEDULE_SCREEN" | "REQUEST_LINK" | "SEND_ASSESSMENT";
  label: string;
  meta?: Record<string, string | number | boolean>;
}

export interface AtsUpdatePayload {
  candidateId: string;
  roleId: string;
  stage: AtsStage;
  tags: string[];
  note: string;
  tasks: AtsTask[];
  // optional: something the Nova Act agent can use as “instructions”
  actionHints?: {
    recommendedCta: string;
    reason: string;
  };
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export function toAtsUpdatePayload(packet: CandidatePacketResult): AtsUpdatePayload {
  const tags: string[] = [];

  tags.push(`lane:${packet.triage.lane}`);
  tags.push(`fit:${Math.round(packet.triage.fitScore * 100)}`);

  if (packet.verify.riskScore >= 0.6) tags.push("risk:high");
  else if (packet.verify.riskScore >= 0.35) tags.push("risk:medium");
  else tags.push("risk:low");

  // skills tags (from triage evidence if you have it)
  // keep lightweight for demo:
  for (const kw of packet.triage.matchedKeywords ?? []) tags.push(`skill:${kw.toLowerCase()}`);

  // stage decision (demo logic)
  const stage: AtsStage =
    packet.triage.lane === "RECRUITER_NOW" ? "INTERVIEW"
    : packet.triage.lane === "QUICK_ASYNC_SCREEN" ? "SCREEN"
    : "HOLD";

  const topFlags = packet.verify.flags.slice(0, 2).map(f => `- ${f.type} (${f.severity}): ${f.reason}`).join("\n");

  const microscreenLine = packet.microscreen
    ? `Microscreen overall: ${packet.microscreen.overall.toFixed(2)} (conf ${packet.microscreen.confidence.toFixed(2)})`
    : `Microscreen: not run`;

  const note = [
    `FairSignal Summary`,
    `Fit: ${(packet.triage.fitScore * 100).toFixed(0)}% | Lane: ${packet.triage.lane}`,
    `Verify risk: ${(packet.verify.riskScore * 100).toFixed(0)}%`,
    microscreenLine,
    ``,
    `Top evidence:`,
    ...(packet.triage.evidenceHighlights?.slice(0, 3).map(e => `- ${e}`) ?? []),
    ``,
    `Flags:`,
    topFlags || "- None",
    ``,
    `Recommended next step: ${packet.primaryCTA.label}`,
  ].join("\n");

  const tasks: AtsTask[] = [];
  for (const a of packet.verify.suggestedActions.slice(0, 3)) {
    if (a.action === "REQUEST_LINKEDIN") tasks.push({ type: "REQUEST_LINK", label: a.label, meta: { kind: "linkedin" } });
    if (a.action === "REQUEST_PORTFOLIO") tasks.push({ type: "REQUEST_LINK", label: a.label, meta: { kind: "portfolio" } });
    if (a.action === "SEND_CODE_SCREEN") tasks.push({ type: "SEND_ASSESSMENT", label: a.label, meta: { kind: "coding" } });
    if (a.action === "ASK_FOLLOWUP") tasks.push({ type: "FOLLOW_UP", label: a.label });
  }

  return {
    candidateId: packet.candidateId,
    roleId: packet.roleId,
    stage,
    tags: uniq(tags),
    note,
    tasks,
    actionHints: {
      recommendedCta: packet.primaryCTA.action,
      reason: packet.summary,
    },
  };
}