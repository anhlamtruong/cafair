#!/usr/bin/env node

import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import { loadRepoEnv } from "./openclaw-env.mjs";

const execFileAsync = promisify(execFile);
const { repoRoot } = loadRepoEnv(import.meta.url);
const baseUrl = (process.env.AIHIRE_BASE_URL || "http://localhost:3002").replace(
  /\/$/,
  "",
);
const agentName = process.env.OPENCLAW_AGENT || "main";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function usage() {
  log("Usage:");
  log("  node apps/web-client/scripts/openclaw-live-test.mjs");
  log("  node apps/web-client/scripts/openclaw-live-test.mjs --social-only");
  log("  node apps/web-client/scripts/openclaw-live-test.mjs --workflow-only");
  log("");
  log("Options:");
  log("  --social-only     Run only the social-screen OpenClaw agent turn");
  log("  --workflow-only   Run only the recruiter workflow OpenClaw agent turn");
  log("  --help            Show this help");
  log("");
  log(`AIHIRE_BASE_URL defaults to ${baseUrl}`);
  log(`OPENCLAW_AGENT defaults to ${agentName}`);
}

async function runOpenClawJson(args) {
  const { stdout, stderr } = await execFileAsync(
    "npx",
    ["openclaw@latest", ...args],
    {
      cwd: repoRoot,
      env: process.env,
      maxBuffer: 1024 * 1024 * 8,
    },
  );

  const text = stdout.trim();
  if (!text) {
    throw new Error(stderr.trim() || "OpenClaw command returned no output");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Expected JSON output from OpenClaw, received:\n${text}${stderr.trim() ? `\n${stderr.trim()}` : ""}`,
    );
  }
}

async function runOpenClawText(args) {
  const { stdout, stderr } = await execFileAsync(
    "npx",
    ["openclaw@latest", ...args],
    {
      cwd: repoRoot,
      env: process.env,
      maxBuffer: 1024 * 1024 * 4,
    },
  );

  return `${stdout}${stderr}`.trim();
}

function extractText(result) {
  return result?.result?.payloads
    ?.map((payload) => payload?.text)
    .filter(Boolean)
    .join("\n\n");
}

async function runHealthCheck() {
  const output = await runOpenClawText(["health"]);
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const heartbeatLine = lines.find((line) => line.includes("Heartbeat interval"));
  const sessionLine = lines.find((line) => line.startsWith("Session store"));

  log("OpenClaw health check passed.");
  if (heartbeatLine) {
    log(heartbeatLine);
  }
  if (sessionLine) {
    log(sessionLine);
  }
}

async function runSocialScreenTurn() {
  const prompt =
    "Use the aihire-social-screen skill to start a social-screen batch for one candidate named OpenClaw Live Test with role Software Engineer, school Virginia Tech, and resume text 'Built AI and full-stack systems with strong execution in 2025.' Then wait for completion and give me a concise recruiter summary.";

  const result = await runOpenClawJson([
    "agent",
    "--agent",
    agentName,
    "--message",
    prompt,
    "--thinking",
    "low",
    "--json",
  ]);

  const text = extractText(result);
  if (!text) {
    throw new Error("Social-screen turn completed without a text payload");
  }

  log("");
  log("Social-screen live turn succeeded.");
  log(text);
}

async function runWorkflowTurn() {
  const prompt =
    "Use the aihire-recruiter-workflows skill to run a recruiter workflow for candidate Workflow Alias Test. Use candidateName consistently for the candidate field. The workflow should include triage_candidate, social_screen_candidate, candidate_packet.build, and recruiter_actions.draft. Use role AI Music Engineer with must-have keywords PyTorch, real-time, and full-stack, plus nice-to-have keyword React. Use resume text 'Built real-time AI systems with PyTorch and React in 2025.' and transcript text 'Shipped full-stack product features.' Include one simple public web result showing strong AI and full-stack work. Then summarize the workflow outcome for a recruiter.";

  const result = await runOpenClawJson([
    "agent",
    "--agent",
    agentName,
    "--message",
    prompt,
    "--thinking",
    "low",
    "--json",
  ]);

  const text = extractText(result);
  if (!text) {
    throw new Error("Workflow turn completed without a text payload");
  }

  log("");
  log("Recruiter workflow live turn succeeded.");
  log(text);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("help")) {
    usage();
    return;
  }

  const socialOnly = process.argv.includes("--social-only");
  const workflowOnly = process.argv.includes("--workflow-only");

  if (socialOnly && workflowOnly) {
    throw new Error("Choose only one of --social-only or --workflow-only");
  }

  log(`Using AIHIRE_BASE_URL=${baseUrl}`);
  log(`Using OPENCLAW_AGENT=${agentName}`);

  await runHealthCheck();

  if (!workflowOnly) {
    await runSocialScreenTurn();
  }

  if (!socialOnly) {
    await runWorkflowTurn();
  }

  log("");
  log("OpenClaw live test completed successfully.");
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
