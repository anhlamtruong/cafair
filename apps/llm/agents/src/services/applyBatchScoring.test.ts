import { describe, expect, it } from "vitest";
import { getDefaultApplyBatchCandidateProfile, rankApplyBatchJobs } from "./applyBatchScoring.js";
import type { SimplifyGithubJobRow } from "./simplifyGithubJobs.js";

const jobs: SimplifyGithubJobRow[] = [
  {
    rowKey: "a",
    company: "OpenAI",
    roleTitle: "Software Engineer Intern",
    location: "San Francisco, CA",
    applyUrl: "https://jobs.ashbyhq.com/openai/123/application",
    sourceUrl: "https://example.com",
    sourceType: "markdown",
    raw: {},
    provider: "ashby",
  },
  {
    rowKey: "b",
    company: "ACME",
    roleTitle: "Marketing Intern",
    location: "Remote",
    applyUrl: "https://jobs.example.com/marketing",
    sourceUrl: "https://example.com",
    sourceType: "markdown",
    raw: {},
    provider: "other",
  },
  {
    rowKey: "c",
    company: "Data Corp",
    roleTitle: "Machine Learning Intern",
    location: "Remote",
    applyUrl: "https://boards.greenhouse.io/datacorp/jobs/42",
    sourceUrl: "https://example.com",
    sourceType: "markdown",
    raw: {},
    provider: "greenhouse",
  },
];

describe("rankApplyBatchJobs", () => {
  it("ranks SWE/backend/ML roles above non-tech roles deterministically", async () => {
    const ranked = await rankApplyBatchJobs(
      jobs,
      getDefaultApplyBatchCandidateProfile({ candidateLabel: "Nguyen Phan Nguyen" }),
      { applyThreshold: 70, maxConcurrency: 2 },
    );

    expect(ranked[0].roleTitle).toBe("Machine Learning Intern");
    expect(ranked[1].roleTitle).toBe("Software Engineer Intern");
    expect(ranked[2].roleTitle).toBe("Marketing Intern");
    expect(ranked[2].decision).toBe("skip");
    expect(ranked[0].decision).toBe("apply");
  });

  it("caps strong technical matches without an intern token to review", async () => {
    const ranked = await rankApplyBatchJobs(
      [
        {
          rowKey: "x",
          company: "Cambridge Mobile Telematics",
          roleTitle: "Backend Machine Learning Software Engineer",
          location: "Remote",
          applyUrl: "https://boards.greenhouse.io/example/jobs/1",
          sourceUrl: "https://example.com",
          sourceType: "markdown",
          raw: {},
          provider: "greenhouse",
        },
      ],
      getDefaultApplyBatchCandidateProfile({ candidateLabel: "Nguyen Phan Nguyen" }),
      {
        applyThreshold: 70,
        maxConcurrency: 1,
        snippetLoader: async () => "Work on platform APIs, distributed systems, and data pipelines.",
      },
    );

    expect(ranked[0]?.fitScore).toBeGreaterThanOrEqual(70);
    expect(ranked[0]?.decision).toBe("review");
    expect(ranked[0]?.fitReasons.join(" ")).toContain("capped at review");
  });

  it("does not trigger false negative-token matches from substrings", async () => {
    const ranked = await rankApplyBatchJobs(
      [
        {
          rowKey: "y",
          company: "Northwestern Mutual",
          roleTitle: "Application Development Intern",
          location: "Remote",
          applyUrl: "https://boards.greenhouse.io/example/jobs/2",
          sourceUrl: "https://example.com",
          sourceType: "markdown",
          raw: {},
          provider: "greenhouse",
        },
      ],
      getDefaultApplyBatchCandidateProfile({ candidateLabel: "Nguyen Phan Nguyen" }),
      {
        applyThreshold: 70,
        maxConcurrency: 1,
        snippetLoader: async () => "Work on backend APIs and distributed systems in a summer internship.",
      },
    );

    expect(ranked[0]?.fitReasons.join(" ")).not.toContain("Negative family detected");
  });

  it("penalizes ambiguous intern titles without strong SWE/ML/Data signals", async () => {
    const ranked = await rankApplyBatchJobs(
      [
        {
          rowKey: "z",
          company: "Harris Computer",
          roleTitle: "Product Intern",
          location: "Remote",
          applyUrl: "https://company.wd1.myworkdayjobs.com/en-US/Careers/job/3",
          sourceUrl: "https://example.com",
          sourceType: "markdown",
          raw: {},
          provider: "workday",
        },
      ],
      getDefaultApplyBatchCandidateProfile({ candidateLabel: "Nguyen Phan Nguyen" }),
      {
        applyThreshold: 70,
        maxConcurrency: 1,
        snippetLoader: async () => "Learn product workflows and cross-functional collaboration.",
      },
    );

    expect(ranked[0]?.fitScore).toBeLessThan(70);
    expect(ranked[0]?.decision).toBe("skip");
  });

  it("forces generic systems engineer titles to review", async () => {
    const ranked = await rankApplyBatchJobs(
      [
        {
          rowKey: "sys",
          company: "Ciena",
          roleTitle: "Systems Engineer Intern",
          location: "Remote",
          applyUrl: "https://company.wd1.myworkdayjobs.com/en-US/Careers/job/4",
          sourceUrl: "https://example.com",
          sourceType: "markdown",
          raw: {},
          provider: "workday",
        },
      ],
      getDefaultApplyBatchCandidateProfile({ candidateLabel: "Nguyen Phan Nguyen" }),
      {
        applyThreshold: 70,
        maxConcurrency: 1,
        snippetLoader: async () => "Support network systems and platform tooling in a summer internship.",
      },
    );

    expect(ranked[0]?.decision).toBe("review");
    expect(ranked[0]?.fitReasons.join(" ")).toContain("Systems Engineer");
  });
});
