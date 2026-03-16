import { describe, expect, it } from "vitest";
import { detectApplyBatchProvider } from "./applyBatchProviderDetector.js";

describe("detectApplyBatchProvider", () => {
  it("detects supported and known ATS providers", () => {
    expect(detectApplyBatchProvider("https://boards.greenhouse.io/company/jobs/123")).toBe("greenhouse");
    expect(detectApplyBatchProvider("https://jobs.ashbyhq.com/openai/abc/application")).toBe("ashby");
    expect(detectApplyBatchProvider("https://company.wd1.myworkdayjobs.com/en-US/Careers/job/123")).toBe("workday");
    expect(detectApplyBatchProvider("https://jobs.lever.co/company/123")).toBe("lever");
    expect(detectApplyBatchProvider("https://jobs.smartrecruiters.com/company/role")).toBe("smartrecruiters");
    expect(detectApplyBatchProvider("https://careers.icims.com/jobs/123/software-engineer")).toBe("icims");
    expect(detectApplyBatchProvider("https://company.taleo.net/careersection/jobdetail.ftl?job=123")).toBe("taleo");
    expect(detectApplyBatchProvider("https://www.rippling.com/careers/job/123")).toBe("rippling");
    expect(detectApplyBatchProvider("https://company.example.com/jobs/123")).toBe("other");
  });
});
