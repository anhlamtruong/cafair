// agents/src/agents/candidatePacket.ts

import type { TriageRequest, TriageResult } from "../types.ts";
import { runTriage } from "./triage.ts";
import { runVerify, type VerifyResult } from "./verify.ts";
import { runMicroScreen, type MicroScreenResult } from "./microscreen.ts";

export interface CandidatePacketRequest extends TriageRequest {
  // If you want to force microscreen evaluation even if transcript is short
  enableMicroScreen?: boolean;
}

export interface CandidatePacketResult {
  candidateId: string;
  roleId: string;

  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;

  // For the UI to show a single recommended CTA button
  primaryCTA: {
    label: string;
    action:
      | "OPEN_RECRUITER_CHAT"
      | "SEND_MICRO_SCREEN"
      | "REQUEST_LINKEDIN"
      | "REQUEST_PORTFOLIO"
      | "SEND_CODE_SCREEN"
      | "REDIRECT";
  };

  summary: string;
}

export function buildCandidatePacket(req: CandidatePacketRequest): CandidatePacketResult {
  const triage = runTriage(req);

  const verify = runVerify({
    candidateId: req.candidateId,
    roleId: req.role.roleId,
    roleName: req.role.roleName,
    mustHaveKeywords: req.role.mustHaveKeywords ?? [],
    artifacts: req.artifacts,
  });

  const transcript = (req.artifacts.transcriptText ?? "").trim();
  const enableMicro = req.enableMicroScreen ?? true;

  const microscreen =
    enableMicro && transcript.length >= 40
      ? runMicroScreen({
          candidateId: req.candidateId,
          roleId: req.role.roleId,
          roleName: req.role.roleName,
          mustHaveKeywords: req.role.mustHaveKeywords ?? [],
          responseTranscriptText: transcript,
        })
      : undefined;

  // Primary CTA logic (simple + demo-friendly)
  const primaryCTA = (() => {
    if (verify.riskScore >= 0.6) {
      const act = verify.suggestedActions[0]?.action ?? "ASK_FOLLOWUP";
      if (act === "REQUEST_LINKEDIN") return { label: "Request LinkedIn", action: "REQUEST_LINKEDIN" as const };
      if (act === "REQUEST_PORTFOLIO") return { label: "Request Portfolio", action: "REQUEST_PORTFOLIO" as const };
      if (act === "SEND_CODE_SCREEN") return { label: "Send Coding Screen", action: "SEND_CODE_SCREEN" as const };
      return { label: "Ask Follow-up", action: "OPEN_RECRUITER_CHAT" as const };
    }

    if (triage.lane === "RECRUITER_NOW") return { label: "Open Recruiter Chat", action: "OPEN_RECRUITER_CHAT" as const };
    if (triage.lane === "QUICK_ASYNC_SCREEN") return { label: "Send 3-min Screen", action: "SEND_MICRO_SCREEN" as const };
    return { label: "Redirect", action: "REDIRECT" as const };
  })();

  const summary = [
    triage.summary,
    verify.summary,
    microscreen ? microscreen.summary : "No micro-screen transcript available yet.",
  ].join(" ");

  return {
    candidateId: req.candidateId,
    roleId: req.role.roleId,
    triage,
    verify,
    microscreen,
    primaryCTA,
    summary,
  };
}