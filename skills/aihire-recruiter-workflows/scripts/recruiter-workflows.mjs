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
      "  recruiter-workflows.mjs skills",
      "  recruiter-workflows.mjs run-skill <skillName>      # reads JSON from stdin",
      "  recruiter-workflows.mjs run-workflow               # reads JSON from stdin",
      "  recruiter-workflows.mjs notifications [--workflow <id>] [--batch <id>]",
      "",
      `AIHIRE_BASE_URL defaults to ${baseUrl}`,
    ].join("\n"),
  );
  process.stderr.write("\n");
}

function parseNotificationArgs(args) {
  const query = new URLSearchParams();

  for (let i = 0; i < args.length; i += 1) {
    const part = args[i];
    if (part === "--workflow" && args[i + 1]) {
      query.set("workflowId", args[i + 1]);
      i += 1;
      continue;
    }

    if (part === "--batch" && args[i + 1]) {
      query.set("batchJobId", args[i + 1]);
      i += 1;
      continue;
    }
  }

  return query.toString() ? `?${query.toString()}` : "";
}

async function main() {
  const [, , command, arg] = process.argv;

  if (!command || command === "--help" || command === "help") {
    usage();
    process.exit(command ? 0 : 1);
  }

  switch (command) {
    case "skills": {
      const result = await requestJson("/api/aihire/openclaw/skills");
      printJson(result);
      return;
    }

    case "run-skill": {
      if (!arg) {
        usage();
        process.exit(1);
      }

      const input = await readJsonFromStdin();
      const result = await requestJson("/api/aihire/openclaw/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: arg,
          input,
        }),
      });
      printJson(result);
      return;
    }

    case "run-workflow": {
      const workflow = await readJsonFromStdin();
      const result = await requestJson("/api/aihire/openclaw/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflow),
      });
      printJson(result);
      return;
    }

    case "notifications": {
      const suffix = parseNotificationArgs(process.argv.slice(3));
      const result = await requestJson(`/api/aihire/openclaw/notifications${suffix}`);
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
