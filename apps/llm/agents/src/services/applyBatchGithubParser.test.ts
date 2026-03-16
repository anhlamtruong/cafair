import { describe, expect, it } from "vitest";
import { parseSimplifyJobsMarkdown } from "./simplifyGithubJobs.js";

describe("parseSimplifyJobsMarkdown", () => {
  it("parses README table rows into structured jobs", () => {
    const markdown = `
| Company | Role | Location | Application/Link | Age |
| --- | --- | --- | --- | --- |
| OpenAI | Software Engineer Intern | San Francisco, CA | [Apply](https://jobs.ashbyhq.com/openai/123/application) | 2d |
| Anthropic | Backend Engineer Intern | Remote | [Apply](https://boards.greenhouse.io/anthropic/jobs/123) | 1d |
`;

    const rows = parseSimplifyJobsMarkdown(
      markdown,
      "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/main/README.md",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      company: "OpenAI",
      roleTitle: "Software Engineer Intern",
      location: "San Francisco, CA",
      applyUrl: "https://jobs.ashbyhq.com/openai/123/application",
      provider: "ashby",
    });
    expect(rows[1]).toMatchObject({
      company: "Anthropic",
      roleTitle: "Backend Engineer Intern",
      provider: "greenhouse",
    });
  });

  it("deduplicates repeated rows", () => {
    const markdown = `
| Company | Role | Location | Apply |
| --- | --- | --- | --- |
| OpenAI | Software Engineer Intern | SF | [Apply](https://jobs.ashbyhq.com/openai/123/application) |
| OpenAI | Software Engineer Intern | SF | [Apply](https://jobs.ashbyhq.com/openai/123/application) |
`;
    const rows = parseSimplifyJobsMarkdown(markdown, "https://example.com");
    expect(rows).toHaveLength(1);
  });

  it("carries forward the parent company for continuation rows", () => {
    const markdown = `
| Company | Role | Location | Apply |
| --- | --- | --- | --- |
| OpenAI | Machine Learning Intern | SF | [Apply](https://jobs.ashbyhq.com/openai/123/application) |
| ↳ | Software Engineer Intern | SF | [Apply](https://boards.greenhouse.io/openai/jobs/456) |
`;
    const rows = parseSimplifyJobsMarkdown(markdown, "https://example.com");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.company).toBe("OpenAI");
    expect(rows[1]?.roleTitle).toBe("Software Engineer Intern");
  });
});
