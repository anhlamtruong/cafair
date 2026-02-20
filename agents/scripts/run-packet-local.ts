// agents/scripts/run-packet-local.ts

import { buildCandidatePacket } from "../src/agents/candidatePacket.ts";
import type { TriageRequest } from "../src/types.ts";

function sample(): TriageRequest {
  return {
    candidateId: "cand_999",
    candidateName: "Jamie Park",
    fair: { fairId: "fair_2026_online_vt", boothId: "booth_main", timestampISO: new Date().toISOString() },
    role: {
      roleId: "role_ml_intern",
      roleName: "ML Intern (NLP)",
      jobDescriptionText: "Python, ML fundamentals, NLP, ship projects.",
      mustHaveKeywords: ["python", "nlp", "machine learning"],
      niceToHaveKeywords: ["pytorch", "docker", "aws", "retrieval"],
      thresholds: { recruiterNow: 0.72, quickScreen: 0.45 },
    },
    artifacts: {
      resumeText: `Class of 2026. Built an NLP chatbot in Python using PyTorch. Deployed with Docker on AWS.`,
      transcriptText: `I shipped a retrieval QA demo in Python. For evaluation I used top-k accuracy and error analysis.`,
      essayText: `I’m excited about building real systems and learning from mentorship.`,
    },
  };
}

function main() {
  const packet = buildCandidatePacket({ ...sample(), enableMicroScreen: true });
  console.log("=== CANDIDATE PACKET =====");
  console.log(JSON.stringify(packet, null, 2));
}

main();




