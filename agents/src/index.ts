// agents/src/index.ts

export type {
  Lane,
  CandidateArtifacts,
  FairContext,
  RoleProfile,
  TriageRequest,
  EvidenceItem,
  NextAction,
  TriageResult,
} from "./types.ts";

export { runTriage } from "./agents/triage.ts";