import { runApplyBatchFromGithub } from "../src/services/applyBatchRunner.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readNumberArg(flag: string, fallback: number): number {
  const raw = readArg(flag);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanArg(flag: string, fallback: boolean): boolean {
  const raw = readArg(flag);
  if (!raw) {
    return process.argv.includes(flag) ? true : fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function readModeArg(): "demo" | "deterministic" | "nova" {
  const raw = readArg("--mode")?.trim().toLowerCase();
  if (raw === "demo" || raw === "nova") {
    return raw;
  }
  return "deterministic";
}

async function main(): Promise<void> {
  const mode = readModeArg();
  const candidateSlug = readArg("--candidate");
  const candidateLabel =
    readArg("--candidate-label") ??
    (candidateSlug ? candidateSlug.replace(/-/g, " ") : "Default Candidate");

  const result = await runApplyBatchFromGithub({
    mode,
    candidateId: readArg("--candidate-id"),
    candidateLabel,
    candidateSlug,
    sourceUrl:
      readArg("--source-url") ??
      readArg("--sourceUrl") ??
      "https://github.com/SimplifyJobs/Summer2026-Internships",
    maxJobsToApply:
      readNumberArg("--maxJobsToApply", readNumberArg("--max-jobs", 10)),
    applyThreshold:
      readNumberArg("--applyThreshold", readNumberArg("--apply-threshold", 70)),
    maxFitConcurrency:
      readNumberArg("--maxFitConcurrency", readNumberArg("--max-concurrency", 5)),
    maxApplyConcurrency: readNumberArg("--maxApplyConcurrency", 1),
    autoSubmit: readBooleanArg("--autoSubmit", false),
    visibleBrowser: readBooleanArg("--visible-browser", false),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId: result.manifest.runId,
        runDir: result.manifest.runDir,
        mode: result.manifest.mode,
        status: result.manifest.status,
        reportPath: result.manifest.paths.reportJson,
        eventsPath: result.manifest.paths.eventsJsonl,
        selectedCount: result.report.summary.selectedCount,
        appliedCount: result.report.summary.appliedCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "Failed to run apply-batch-from-github:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
