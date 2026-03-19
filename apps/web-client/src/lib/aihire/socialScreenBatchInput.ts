import type { SocialScreenBatchCandidate } from "@/lib/aihire/socialScreenBatchTypes";

export type SocialScreenBatchCandidateInput = {
  candidateId?: string | null;
  name?: string | null;
  roleTitle?: string | null;
  school?: string | null;
  resumeText?: string | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSocialScreenBatchCandidates(
  candidates: SocialScreenBatchCandidateInput[],
): SocialScreenBatchCandidate[] {
  return candidates.map((candidate, index) => ({
    candidateId: clean(candidate.candidateId) || `candidate_${index + 1}`,
    name: clean(candidate.name) || `Candidate ${index + 1}`,
    roleTitle: clean(candidate.roleTitle),
    school: clean(candidate.school),
    resumeText:
      typeof candidate.resumeText === "string" ? candidate.resumeText : "",
  }));
}
