import { buildCandidatePacket } from "../src/agents/candidatePacket.ts";
import { toAtsUpdatePayload } from "../src/agents/atsPayload.ts";

function main() {
  const packet = buildCandidatePacket({
    candidateId: "cand_demo",
    candidateName: "Demo Candidate",
    fair: { fairId: "fair_demo", boothId: "booth_1", timestampISO: new Date().toISOString() },
    role: {
      roleId: "role_ml_intern",
      roleName: "ML Intern (NLP)",
      jobDescriptionText: "Python, ML fundamentals, NLP, shipped projects.",
      mustHaveKeywords: ["python", "nlp", "machine learning"],
      niceToHaveKeywords: ["docker", "aws", "pytorch"],
      thresholds: { recruiterNow: 0.72, quickScreen: 0.45 },
    },
    artifacts: {
      resumeText: "Class of 2026. Built NLP retrieval in Python. Deployed with Docker.",
      transcriptText: "I shipped a retrieval demo in Python. I evaluated top-k accuracy and latency.",
      essayText: "I enjoy building real products with measurable impact.",
    },
    enableMicroScreen: true,
  });

  const ats = toAtsUpdatePayload(packet);

  console.log("=== PACKET ===");
  console.log(JSON.stringify(packet, null, 2));
  console.log("\n=== ATS UPDATE PAYLOAD ===");
  console.log(JSON.stringify(ats, null, 2));
}

main();