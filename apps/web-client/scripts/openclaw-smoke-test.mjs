#!/usr/bin/env node

import process from "node:process";

const baseUrl = (process.env.AIHIRE_BASE_URL || "http://localhost:3002").replace(
  /\/$/,
  "",
);
const webhookUrl = process.env.OPENCLAW_WEBHOOK_URL;
const webhookFormat = process.env.OPENCLAW_WEBHOOK_FORMAT;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function usage() {
  log("Usage:");
  log("  node apps/web-client/scripts/openclaw-smoke-test.mjs");
  log("");
  log(`AIHIRE_BASE_URL defaults to ${baseUrl}`);
  log("OPENCLAW_WEBHOOK_URL is optional and enables webhook delivery checks.");
  log(
    "OPENCLAW_WEBHOOK_FORMAT is optional. Use `slack`, `whatsapp`, or `discord` to preview channel-specific webhook payloads.",
  );
}

async function requestJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();

  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status} ${response.statusText}): ${JSON.stringify(parsed)}`,
    );
  }

  return parsed;
}

async function waitForBatch(batchJobId, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await requestJson(
      `/api/aihire/openclaw/social-screen-batch/${encodeURIComponent(batchJobId)}`,
    );

    if (status.job?.status === "completed" || status.job?.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for batch ${batchJobId}`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("help")) {
    usage();
    return;
  }

  log(`Using AIHIRE_BASE_URL=${baseUrl}`);
  if (webhookUrl) {
    log(`Using OPENCLAW_WEBHOOK_URL=${webhookUrl}`);
  }
  if (webhookFormat) {
    log(`Using OPENCLAW_WEBHOOK_FORMAT=${webhookFormat}`);
  }

  const skills = await requestJson("/api/aihire/openclaw/skills");
  log(`Discovered ${skills.skills.length} OpenClaw adapter skills.`);

  const workflowInfo = await requestJson("/api/aihire/openclaw/workflows");
  log(
    `Workflow adapter reports ${workflowInfo.supportedSkills.length} supported skills.`,
  );

  const batchPayload = {
    candidates: [
      {
        candidateId: "cand_smoke_001",
        name: "OpenClaw Smoke Test",
        roleTitle: "Software Engineer",
        school: "Virginia Tech",
        resumeText: "Built AI and full-stack systems with strong execution in 2025.",
      },
    ],
    notify: {
      webhookUrl,
      webhookFormat,
      channelId: "recruiter-social",
      conversationId: "thread-smoke-batch-001",
    },
    pollIntervalMs: 400,
    timeoutMs: 15000,
  };

  const batchStart = await requestJson("/api/aihire/openclaw/social-screen-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchPayload),
  });
  log(`Started batch ${batchStart.batchJobId}.`);

  const batchStatus = await waitForBatch(batchStart.batchJobId);
  log(
    `Batch ${batchStart.batchJobId} finished with status=${batchStatus.job.status} and text="${batchStatus.summary.text}"`,
  );

  const workflowPayload = {
    workflowId: "wf_smoke_001",
    stopOnError: true,
    notify: {
      webhookUrl,
      webhookFormat,
      channelId: "recruiter-social",
      conversationId: "thread-smoke-workflow-001",
    },
    steps: [
      {
        stepId: "triage",
        skill: "triage_candidate",
        input: {
          candidateId: "cand_smoke_002",
          candidateName: "Workflow Smoke Test",
          role: {
            roleId: "role_001",
            roleName: "AI Music Engineer",
            mustHaveKeywords: ["PyTorch", "real-time", "full-stack"],
            niceToHaveKeywords: ["React"],
          },
          artifacts: {
            resumeText:
              "Built real-time AI systems with PyTorch and React in 2025.",
            transcriptText: "Shipped full-stack product features.",
          },
        },
      },
      {
        stepId: "ats",
        skill: "recruiter_actions.draft",
        input: {
          candidateId: "cand_smoke_002",
          candidateName: "Workflow Smoke Test",
          role: {
            roleId: "role_001",
            roleName: "AI Music Engineer",
            mustHaveKeywords: ["PyTorch", "real-time", "full-stack"],
            niceToHaveKeywords: ["React"],
          },
          artifacts: {
            resumeText:
              "Built real-time AI systems with PyTorch and React in 2025.",
            transcriptText: "Shipped full-stack product features.",
          },
        },
      },
    ],
  };

  const workflowResult = await requestJson("/api/aihire/openclaw/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workflowPayload),
  });
  log(
    `Workflow ${workflowResult.workflowId} finished with ok=${workflowResult.ok} and text="${workflowResult.summaryText}"`,
  );

  const workflowNotifications = await requestJson(
    `/api/aihire/openclaw/notifications?workflowId=${encodeURIComponent(workflowResult.workflowId)}`,
  );
  log(
    `Workflow notifications recorded: ${workflowNotifications.count}. Latest delivery=${workflowNotifications.notifications[0]?.delivery?.delivered ?? false}`,
  );

  log("OpenClaw smoke test completed successfully.");
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
