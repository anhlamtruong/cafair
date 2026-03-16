import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTempApplyBatchBaseDir,
  runApplyBatchFromGithub,
} from "./applyBatchRunner.js";
import type { SimplifyGithubJobRow } from "./simplifyGithubJobs.js";

function makeJob(
  input: Partial<SimplifyGithubJobRow> & Pick<SimplifyGithubJobRow, "rowKey" | "company" | "roleTitle" | "applyUrl" | "provider">,
): SimplifyGithubJobRow {
  return {
    rowKey: input.rowKey,
    company: input.company,
    roleTitle: input.roleTitle,
    location: input.location ?? "Remote",
    applyUrl: input.applyUrl,
    sourceUrl: "https://example.com",
    sourceType: "markdown",
    raw: {},
    provider: input.provider,
    age: input.age,
  };
}

const cleanupDirs: string[] = [];

afterEach(() => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function parseJsonFromStdout(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in stdout:\n${stdout}`);
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function runPythonBridge(payload: Record<string, unknown>, env?: NodeJS.ProcessEnv) {
  const scriptPath = path.join(
    process.cwd(),
    "apps/llm/agents/scripts/apply-agent/run-nova.py",
  );

  return spawnSync("python3", [scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf-8",
    input: JSON.stringify(payload),
  });
}

describe("runApplyBatchFromGithub", () => {
  it("accepts company in the Python bridge for workday providers and reports managed api sessions clearly", () => {
    const payload = {
      runId: "compat_workday",
      targetUrl:
        "https://company.wd1.myworkdayjobs.com/en-US/Careers/job/1",
      provider: "workday",
      mode: "live",
      transport: "api",
      shouldApply: true,
      safeStopBeforeSubmit: true,
      company: "Proofpoint",
      roleTitle: "Backend Engineer Intern",
      selectors: [
        "a[data-automation-id='applyManually']",
        "button[data-automation-id='applyManually']",
        "button",
        "form",
        "input",
      ],
      plannedSteps: [],
    };

    const result = runPythonBridge(payload, {
      NOVA_ACT_API: "",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain(
      "unexpected keyword argument 'company'",
    );

    const parsed = parseJsonFromStdout(result.stdout);

    expect(parsed.ok).toBe(true);
    expect(parsed.provider).toBe("workday");
    expect(parsed.browserOpened).toBe(false);
    expect(parsed.sessionType).toBe("managed");
    expect(parsed.transportSummary).toContain("transport=api");
    expect(parsed.transportSummary).toContain("browserOpened=false");
    expect(parsed.transportSummary).toContain("sessionType=managed");

    const browserSession = parsed.browserSession as
      | {
          visible_browser_expected?: boolean;
          browser_opened?: boolean;
          session_type?: string;
        }
      | undefined;
    expect(browserSession?.browser_opened).toBe(false);
    expect(browserSession?.visible_browser_expected).toBe(false);
    expect(browserSession?.session_type).toBe("managed");

    const visibleFields = parsed.visibleFields as
      | Array<{ name?: string }>
      | undefined;
    expect(visibleFields?.some((field) => field.name === "phone")).toBe(true);
  });

  it("keeps plan-only runs non-executed and emits verbose provider plans", () => {
    const result = runPythonBridge({
      runId: "plan_greenhouse",
      targetUrl: "https://boards.greenhouse.io/example/jobs/1",
      provider: "greenhouse",
      mode: "plan",
      transport: "api",
      shouldApply: true,
      safeStopBeforeSubmit: true,
      company: "Example",
      roleTitle: "Software Engineering Intern",
      selectors: ["a[href*='application']", "form", "input"],
      plannedSteps: [],
    });

    expect(result.status).toBe(0);
    const parsed = parseJsonFromStdout(result.stdout);
    expect(parsed.executed).toBe(false);
    expect(parsed.status).toBe("planned");

    const plannedSteps = parsed.plannedSteps as string[] | undefined;
    expect(plannedSteps?.length).toBeGreaterThanOrEqual(40);
  });

  it("builds provider-specific 40+ step plans with expected milestones", () => {
    const cases = [
      {
        provider: "greenhouse",
        targetUrl: "https://boards.greenhouse.io/example/jobs/1",
        selectors: ["a[href*='application']", "form", "input"],
        checks: ["Greenhouse", "Enter manually", "final submit"],
      },
      {
        provider: "ashby",
        targetUrl: "https://jobs.ashbyhq.com/example/1/application",
        selectors: ["form", "button", "input"],
        checks: ["Ashby", "custom question", "final submit"],
      },
      {
        provider: "workday",
        targetUrl: "https://company.wd1.myworkdayjobs.com/en-US/Careers/job/1",
        selectors: ["button[data-automation-id='applyManually']", "form", "input"],
        checks: ["Workday", "sign-in", "review page"],
      },
    ] as const;

    for (const testCase of cases) {
      const result = runPythonBridge({
        runId: `plan_${testCase.provider}`,
        targetUrl: testCase.targetUrl,
        provider: testCase.provider,
        mode: "plan",
        transport: "api",
        shouldApply: true,
        safeStopBeforeSubmit: true,
        company: "Example",
        roleTitle: "Software Engineering Intern",
        selectors: testCase.selectors,
        plannedSteps: [],
      });

      expect(result.status).toBe(0);
      const parsed = parseJsonFromStdout(result.stdout);
      const plannedSteps = parsed.plannedSteps as string[] | undefined;
      expect(plannedSteps?.length).toBeGreaterThanOrEqual(40);
      const joined = (plannedSteps ?? []).join(" ");
      for (const check of testCase.checks) {
        expect(joined).toContain(check);
      }
    }
  });

  it(
    "only applies supported greenhouse/workday/ashby jobs in nova mode",
    async () => {
    const baseRunDir = buildTempApplyBatchBaseDir();
    cleanupDirs.push(baseRunDir);
    const runApplyAgent = vi.fn(async ({ job }: { job: { provider: string } }) => ({
      requestPayload: {
        provider: job.provider,
      },
      stdout: "",
      stderr: "",
      response: {
        ok: true,
        status: "running",
        executed: true,
        message: "Reached safe stop.",
        actionLogs: [
          {
            stepId: "step_1",
            action: "launch_browser",
            detail: "Launch browser",
            status: "completed",
          },
        ],
        browser: {
          summary: {
            blocked_count: 1,
            can_continue: false,
          },
        },
      },
    }));

    const result = await runApplyBatchFromGithub(
      {
        mode: "nova",
        candidateLabel: "Nguyen Phan Nguyen",
        maxJobsToApply: 4,
        allowReviewQueue: true,
      },
      {
        baseRunDir,
        discoverJobs: async () => ({
          resolvedUrl: "https://example.com/source",
          sourceType: "markdown",
          jobs: [
            makeJob({
              rowKey: "gh",
              company: "Graphcore",
              roleTitle: "Software Engineering Intern",
              applyUrl: "https://boards.greenhouse.io/graphcore/jobs/1",
              provider: "greenhouse",
            }),
            makeJob({
              rowKey: "wd",
              company: "Fidelity",
              roleTitle: "Backend Engineer Intern",
              applyUrl: "https://company.wd1.myworkdayjobs.com/en-US/Careers/job/1",
              provider: "workday",
            }),
            makeJob({
              rowKey: "ash",
              company: "OpenAI",
              roleTitle: "Machine Learning Intern",
              applyUrl: "https://jobs.ashbyhq.com/openai/1/application",
              provider: "ashby",
            }),
            makeJob({
              rowKey: "lev",
              company: "Startup",
              roleTitle: "Software Engineer Intern",
              applyUrl: "https://jobs.lever.co/startup/1",
              provider: "lever",
            }),
          ],
        }),
        checkNovaAvailability: async () => ({ available: true }),
        runApplyAgent,
      },
    );

    expect(runApplyAgent).toHaveBeenCalledTimes(3);
    expect(runApplyAgent.mock.calls.map(([arg]) => arg.job.provider).sort()).toEqual([
      "ashby",
      "greenhouse",
      "workday",
    ]);

    const unsupported = result.report.appliedJobs.find((job) => job.provider === "lever");
    expect(unsupported?.applyStatus).toBe("skipped");
    expect(unsupported?.statusReason).toContain("review");
    },
    30000,
  );

  it("propagates visibleBrowser to the runner and blocks managed fallback when visible launch is requested", async () => {
    const baseRunDir = buildTempApplyBatchBaseDir();
    cleanupDirs.push(baseRunDir);

    const runApplyAgent = vi.fn(async ({ manifest }) => {
      expect(manifest.config.visibleBrowser).toBe(true);
      expect(manifest.config.maxApplyConcurrency).toBe(1);

      return {
        requestPayload: {
          provider: "greenhouse",
          visibleBrowser: manifest.config.visibleBrowser,
        },
        stdout: "",
        stderr: "",
        response: {
          ok: true,
          status: "running",
          executed: true,
          message: "Visible browser was requested but a managed session was returned.",
          browserOpened: false,
          sessionType: "managed",
          actionLogs: [],
          browser: {
            summary: {
              blocked_count: 0,
              can_continue: true,
              has_safe_stop: true,
            },
          },
        },
      };
    });

    const result = await runApplyBatchFromGithub(
      {
        mode: "nova",
        candidateLabel: "Nguyen Phan Nguyen",
        maxJobsToApply: 1,
        maxApplyConcurrency: 5,
        visibleBrowser: true,
      },
      {
        baseRunDir,
        discoverJobs: async () => ({
          resolvedUrl: "https://example.com/source",
          sourceType: "markdown",
          jobs: [
            makeJob({
              rowKey: "gh-visible",
              company: "Graphcore",
              roleTitle: "Software Engineering Intern",
              applyUrl: "https://boards.greenhouse.io/graphcore/jobs/1",
              provider: "greenhouse",
            }),
          ],
        }),
        checkNovaAvailability: async () => ({ available: true }),
        runApplyAgent,
      },
    );

    expect(runApplyAgent).toHaveBeenCalledTimes(1);
    expect(result.manifest.config.visibleBrowser).toBe(true);
    expect(result.manifest.config.maxApplyConcurrency).toBe(1);
    expect(result.report.appliedJobs[0]?.applyStatus).toBe("blocked");
    expect(result.report.appliedJobs[0]?.applyResult?.status).toBe("blocked");

    const applyRequestPath = path.join(
      result.manifest.runDir,
      "jobs",
      "gh-visible",
      "apply_request.json",
    );
    const applyRequest = JSON.parse(
      fs.readFileSync(applyRequestPath, "utf-8"),
    ) as { visibleBrowser?: boolean };
    expect(applyRequest.visibleBrowser).toBe(true);

    const events = fs
      .readFileSync(result.manifest.paths.eventsJsonl, "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type?: string; data?: { reason?: string } });
    expect(events.some((event) => event.type === "apply_blocked")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "apply_blocked" &&
          event.data?.reason?.includes("Visible browser"),
      ),
    ).toBe(true);
  });

  it("writes appliedJobs status and per-job artifacts into the final report", async () => {
    const baseRunDir = buildTempApplyBatchBaseDir();
    cleanupDirs.push(baseRunDir);

    const result = await runApplyBatchFromGithub(
      {
        mode: "nova",
        candidateLabel: "Nguyen Phan Nguyen",
        maxJobsToApply: 1,
      },
      {
        baseRunDir,
        discoverJobs: async () => ({
          resolvedUrl: "https://example.com/source",
          sourceType: "markdown",
          jobs: [
            makeJob({
              rowKey: "gh",
              company: "Graphcore",
              roleTitle: "Software Engineering Intern",
              applyUrl: "https://boards.greenhouse.io/graphcore/jobs/1",
              provider: "greenhouse",
            }),
          ],
        }),
        checkNovaAvailability: async () => ({ available: true }),
        runApplyAgent: async () => ({
          requestPayload: {
            provider: "greenhouse",
          },
          stdout: "runner-stdout",
          stderr: "",
          response: {
            ok: true,
            status: "running",
            executed: true,
            message: "Stopped safely before final submit.",
            actionLogs: [
              {
                stepId: "step_1",
                action: "launch_browser",
                detail: "Launch browser",
                status: "completed",
              },
            ],
            browser: {
              summary: {
                blocked_count: 1,
                can_continue: false,
                has_safe_stop: true,
              },
            },
          },
        }),
      },
    );

    expect(result.report.appliedJobs).toHaveLength(1);
    expect(result.report.appliedJobs[0]?.applyStatus).toBe("safe_stopped");
    expect(result.report.appliedJobs[0]?.applyResult?.status).toBe("safe_stopped");
    expect(result.report.appliedJobs[0]?.artifacts?.applyRequestPath).toBeDefined();
    expect(result.report.appliedJobs[0]?.artifacts?.executionReportPath).toBeDefined();
    expect(result.report.appliedJobs[0]?.artifacts?.providerLogsPath).toBeDefined();

    const applyRequestPath = path.join(result.manifest.runDir, "jobs", "gh", "apply_request.json");
    const executionReportPath = path.join(result.manifest.runDir, "jobs", "gh", "execution_report.json");
    const providerLogsPath = path.join(result.manifest.runDir, "jobs", "gh", "provider_logs.jsonl");

    expect(fs.existsSync(applyRequestPath)).toBe(true);
    expect(fs.existsSync(executionReportPath)).toBe(true);
    expect(fs.existsSync(providerLogsPath)).toBe(true);

    const reportOnDisk = JSON.parse(
      fs.readFileSync(result.manifest.paths.reportJson, "utf-8"),
    ) as {
      appliedJobs?: Array<{
        applyStatus?: string;
        applyResult?: { status?: string };
      }>;
    };
    expect(reportOnDisk.appliedJobs?.[0]?.applyStatus).toBe("safe_stopped");
    expect(reportOnDisk.appliedJobs?.[0]?.applyResult?.status).toBe("safe_stopped");
  }, 10000);
});
