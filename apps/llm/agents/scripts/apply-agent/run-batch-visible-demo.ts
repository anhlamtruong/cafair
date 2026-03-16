#!/usr/bin/env tsx
/**
 * Quick batch visible-browser demo.
 * Skips discovery/ranking — applies to a hardcoded list of real Greenhouse jobs
 * sequentially with visible browser so you can watch each one.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JOBS = [
  {
    provider: "greenhouse",
    url: "https://boards.greenhouse.io/neuralink/jobs/6083322003",
    company: "Neuralink",
    role: "Software Engineer Intern - Internal Apps",
  },
  {
    provider: "greenhouse",
    url: "https://boards.greenhouse.io/diligentcorporation/jobs/7897427002",
    company: "Diligent Corporation",
    role: "Product Builder Intern",
  },
  {
    provider: "greenhouse",
    url: "https://boards.greenhouse.io/verkada/jobs/4665498007",
    company: "Verkada",
    role: "Software Engineering Intern, Backend",
  },
];

const repoRoot = path.resolve(__dirname, "../../../../..");

// Load .env so NOVA_ACT_API is available to child processes
import fs from "node:fs";
const envPath = path.join(repoRoot, ".env");
const envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
}
const mergedEnv = { ...process.env, ...envVars };
console.error(`[BATCH_VISIBLE_DEMO] NOVA_ACT_API loaded: ${mergedEnv.NOVA_ACT_API ? "yes" : "NO — browser will not open!"}`);


async function runJob(job: (typeof JOBS)[number], index: number): Promise<string | null> {
  console.error(`\n${"=".repeat(80)}`);
  console.error(`[BATCH_VISIBLE_DEMO] Job ${index + 1}/${JOBS.length}: ${job.company} — ${job.role}`);
  console.error(`[BATCH_VISIBLE_DEMO] URL: ${job.url}`);
  console.error(`[BATCH_VISIBLE_DEMO] visibleBrowser=true, safeStop=true`);
  console.error(`${"=".repeat(80)}\n`);

  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      [
        "tsx",
        "apps/llm/agents/scripts/apply-agent/run-local.ts",
        "--transport", "api",
        "--mode", "live",
        "--provider", job.provider,
        "--url", job.url,
        "--company", job.company,
        "--role", job.role,
        "--should-apply", "true",
        "--safe-stop", "true",
        "--visible-browser",
      ],
      {
        cwd: repoRoot,
        env: mergedEnv,
        stdio: ["ignore", "pipe", "pipe"],  // capture stderr too for replay paths
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text); // still show stderr live
    });

    child.on("close", (code) => {
      console.error(`\n[BATCH_VISIBLE_DEMO] Job ${index + 1} finished (exit=${code})`);
      try {
        const json = JSON.parse(stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1));
        console.error(`[BATCH_VISIBLE_DEMO] Result: browserOpened=${json.browserSession?.browser_opened ?? json.browserOpened} sessionType=${json.browserSession?.session_type ?? json.sessionType} executed=${json.executed}`);
      } catch {
        console.error(`[BATCH_VISIBLE_DEMO] Could not parse result JSON`);
      }

      // Find Nova Act HTML replay path
      const replayMatch = stderr.match(/View your act run here:\s*(\S+\.html)/);
      const replayPath = replayMatch?.[1] ?? null;
      if (replayPath) {
        console.error(`[BATCH_VISIBLE_DEMO] 🎬 Replay: ${replayPath}`);
        // Auto-open in browser
        spawn("open", [replayPath], { stdio: "ignore", detached: true }).unref();
      }

      resolve(replayPath);
    });
  });
}

async function main() {
  console.error(`[BATCH_VISIBLE_DEMO] Starting ${JOBS.length} jobs IN PARALLEL — all 3 Nova Act sessions launch at once!\n`);
  const start = Date.now();

  const replayPaths = await Promise.all(JOBS.map((job, i) => runJob(job, i)));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`\n[BATCH_VISIBLE_DEMO] All ${JOBS.length} jobs complete in ${elapsed}s`);
  console.error(`\n[BATCH_VISIBLE_DEMO] 🎬 Session replays auto-opened in your browser:`);
  for (let i = 0; i < JOBS.length; i++) {
    console.error(`  Job ${i + 1} (${JOBS[i]!.company}): ${replayPaths[i] ?? "no replay found"}`);
  }
}

main().catch((err) => {
  console.error("[BATCH_VISIBLE_DEMO] Fatal error:", err);
  process.exit(1);
});
