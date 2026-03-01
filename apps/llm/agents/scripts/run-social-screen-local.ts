// Path: agents/scripts/run-social-screen-local.ts npx tsx agents/scripts/run-social-screen-local.ts

import { runSocialScreen } from "../src/agents/socialScreen";

const result = runSocialScreen({
  candidateId: "cand_np_001",
  name: "Nguyen Phan Nguyen",
  roleTitle: "AI Music Engineer",
  school: "Georgia Tech",
  linkedinUrl: "https://linkedin.com/in/example",
  githubUrl: "https://github.com/example",
  googleSummary: "Public portfolio and project mentions found",
  resumeText: `
    Developed real-time AI music transcription engine processing audio with <100ms latency.
    Built React-based music visualization dashboard used by 10K+ users.
    3 years ML + web dev. Strong PyTorch and full-stack experience.
  `,
});

console.log(JSON.stringify(result, null, 2));