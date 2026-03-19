#!/usr/bin/env node

import process from "node:process";

const baseUrl = (process.env.AIHIRE_BASE_URL || "http://localhost:3002").replace(
  /\/$/,
  "",
);

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim();
}

async function readJsonFromStdin() {
  const raw = await readStdin();
  if (!raw) {
    throw new Error("Expected JSON payload on stdin");
  }

  return JSON.parse(raw);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
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

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  social-screen-batch.mjs start        # reads JSON from stdin",
      "  social-screen-batch.mjs status <batchJobId>",
      "  social-screen-batch.mjs summary <batchJobId>",
      "  social-screen-batch.mjs results <batchJobId>",
      "  social-screen-batch.mjs retry <batchJobId>",
      "",
      `AIHIRE_BASE_URL defaults to ${baseUrl}`,
    ].join("\n"),
  );
  process.stderr.write("\n");
}

async function main() {
  const [, , command, batchJobId] = process.argv;

  if (!command || command === "--help" || command === "help") {
    usage();
    process.exit(command ? 0 : 1);
  }

  switch (command) {
    case "start": {
      const payload = await readJsonFromStdin();
      const result = await requestJson("/api/aihire/openclaw/social-screen-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      printJson(result);
      return;
    }

    case "status": {
      if (!batchJobId) {
        usage();
        process.exit(1);
      }

      const result = await requestJson(
        `/api/aihire/openclaw/social-screen-batch/${encodeURIComponent(batchJobId)}`,
      );
      printJson(result);
      return;
    }

    case "summary": {
      if (!batchJobId) {
        usage();
        process.exit(1);
      }

      const result = await requestJson(
        `/api/aihire/openclaw/social-screen-batch/${encodeURIComponent(batchJobId)}/summary`,
      );
      printJson(result);
      return;
    }

    case "results": {
      if (!batchJobId) {
        usage();
        process.exit(1);
      }

      const result = await requestJson(
        `/api/aihire/social-screen/batch/${encodeURIComponent(batchJobId)}/results`,
      );
      printJson(result);
      return;
    }

    case "retry": {
      if (!batchJobId) {
        usage();
        process.exit(1);
      }

      const result = await requestJson(
        `/api/aihire/social-screen/batch/${encodeURIComponent(batchJobId)}/retry`,
        {
          method: "POST",
        },
      );
      printJson(result);
      return;
    }

    default:
      usage();
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
