#!/usr/bin/env node

import http from "node:http";
import { execFileSync } from "node:child_process";
import process from "node:process";

const port = Number.parseInt(process.env.PORT || "4011", 10);

function usage() {
  process.stdout.write(
    [
      "Usage:",
      "  node apps/web-client/scripts/openclaw-webhook-catcher.mjs",
      "",
      "Options:",
      "  PORT=4012   Listen on a different port",
      "",
      `Default port: ${port}`,
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function describeExistingListener() {
  try {
    const output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return output || null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");

  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: parsed,
      },
      null,
      2,
    )}\n`,
  );

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});

if (process.argv.includes("--help") || process.argv.includes("help")) {
  usage();
  process.exit(0);
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    process.stderr.write(
      `Port ${port} is already in use. An existing webhook catcher may already be running.\n`,
    );

    const listener = describeExistingListener();
    if (listener) {
      process.stderr.write(`${listener}\n`);
    }

    process.stderr.write(
      [
        "",
        "Either reuse the existing listener, or start a new one on another port:",
        `  PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs`,
        "",
        "Then point the smoke test at that port:",
        `  OPENCLAW_WEBHOOK_URL=http://localhost:4012 npm run test:openclaw-smoke`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});

server.listen(port, () => {
  process.stdout.write(
    `OpenClaw webhook catcher listening on http://localhost:${port}\n`,
  );
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
