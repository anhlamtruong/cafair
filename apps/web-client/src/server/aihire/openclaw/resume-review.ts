import { db } from "@/db";
import { events, jobRoles } from "@/services/recruiter/schema";
import { fetchSerpApiJobs } from "@/lib/aihire/apply-agent/fetchSerpApiJobs";
import { fetchSimplifySummer2026Jobs } from "@/lib/aihire/apply-agent/fetchSimplifySummer2026Jobs";
import { rerankJobsWithBedrock } from "@/lib/aihire/apply-agent/rerankJobsWithBedrock";
import { rankJobsByKeyword } from "@/lib/aihire/apply-agent/rankJobsByKeyword";
import type { ApplyAgentJob, BedrockRankedJob, RuleMatchResult } from "@/lib/aihire/apply-agent/types";
import {
  DEFAULT_TECHNICAL_KEYWORDS,
  normalizeForKeywordMatch,
} from "@/lib/aihire/technicalKeywords";
import { eq } from "drizzle-orm";

type ResumeReviewInput = {
  resumeText: string;
  fileName?: string;
  message?: string;
};

type RoleJobRow = {
  id: string;
  title: string;
  department: string | null;
  status: string | null;
  mustHaveSkills: string[] | null;
  niceToHaveSkills: string[] | null;
  jobDescription: string | null;
  eventName: string | null;
  eventLocation: string | null;
};

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function clip(value: string | null | undefined, max = 220): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitResumeLines(resumeText: string): string[] {
  return resumeText
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function keywordExistsInText(text: string, keyword: string): boolean {
  const normalizedText = normalizeForKeywordMatch(text);
  const normalizedKeyword = normalizeForKeywordMatch(keyword);

  if (!normalizedKeyword || normalizedKeyword.length <= 1) {
    return false;
  }

  if (normalizedKeyword.includes(" ")) {
    return normalizedText.includes(normalizedKeyword);
  }

  const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(^|[^a-z0-9+#./-])${escapedKeyword}([^a-z0-9+#./-]|$)`,
    "i",
  );

  return pattern.test(normalizedText);
}

function findKeywordsInText(text: string, keywords: string[]): string[] {
  return unique(
    keywords.filter((keyword) => keywordExistsInText(text, keyword)),
  ).sort((a, b) => a.localeCompare(b));
}

function countMetrics(line: string): number {
  return (line.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
}

function looksLikeBullet(line: string): boolean {
  return /^[•*-]/.test(line) || line.length > 40;
}

function buildLocalRoleDescription(role: RoleJobRow): string {
  return [
    role.title,
    role.department ?? "",
    role.eventName ?? "",
    role.eventLocation ?? "",
    role.status ?? "",
    role.jobDescription ?? "",
    ...(role.mustHaveSkills ?? []),
    ...(role.niceToHaveSkills ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function inferPreferredRoleTitle(message: string | undefined, fallbackTitle: string | undefined): string {
  const normalized = (message ?? "").trim();
  if (normalized.length === 0) {
    return fallbackTitle ?? "Best matched role";
  }

  const roleMatch = normalized.match(/for\s+an?\s+(.+?)(?:\?|$)/i);
  if (roleMatch?.[1]?.trim()) {
    return roleMatch[1].trim();
  }

  return fallbackTitle ?? "Best matched role";
}

function buildRecruiterTake(
  highlightedLines: Array<{ line: string; keywords: string[] }>,
  matchedKeywords: string[],
  topLocalRole: RuleMatchResult | undefined,
): string[] {
  const takeaways = [
    `Keyword overlap is strongest around ${matchedKeywords.slice(0, 6).join(", ") || "general software work"}.`,
  ];

  if (topLocalRole) {
    takeaways.push(
      `Closest internal fit right now is ${topLocalRole.title} with ${topLocalRole.matchedKeywordCount} matched keywords.`,
    );
  }

  const metricHeavy = highlightedLines.filter((item) => countMetrics(item.line) > 0);
  if (metricHeavy.length > 0) {
    takeaways.push("Resume includes measurable impact, which is good recruiter proof.");
  } else {
    takeaways.push("Impact metrics are a little thin; probe for scale, latency, accuracy, or user impact.");
  }

  if (!matchedKeywords.includes("testing") && !matchedKeywords.includes("unit testing")) {
    takeaways.push("Testing / reliability signals are not obvious from the resume alone.");
  }

  return takeaways;
}

function buildCandidateTake(
  highlightedLines: Array<{ line: string; keywords: string[] }>,
  matchedKeywords: string[],
  preferredRoleTitle: string,
): string[] {
  const suggestions = [
    `Your strongest story for ${preferredRoleTitle} is around ${matchedKeywords.slice(0, 5).join(", ") || "shipping technical projects"}.`,
  ];

  const topLine = highlightedLines[0];
  if (topLine) {
    suggestions.push(`Lead with the line about "${clip(topLine.line, 100) ?? topLine.line}" in interviews and applications.`);
  }

  if (!highlightedLines.some((item) => countMetrics(item.line) > 0)) {
    suggestions.push("Add a few concrete numbers if you can: latency, accuracy, users, revenue, datasets, or time saved.");
  }

  if (!matchedKeywords.includes("aws") && !matchedKeywords.includes("cloud infrastructure")) {
    suggestions.push("If you have cloud or deployment work, make it way more explicit on the resume.");
  }

  return suggestions;
}

function buildInterviewQuestions(
  topLocalRole: RuleMatchResult | undefined,
  matchedKeywords: string[],
): string[] {
  const questions = [
    "What project best proves your strongest technical fit, and what was actually hard about it?",
    "If I opened your GitHub or portfolio right now, what would you want me to look at first?",
  ];

  if (topLocalRole?.matchedKeywords.includes("pytorch")) {
    questions.push("Tell me about the most production-like PyTorch or model-eval workflow you actually built.");
  }

  if (!matchedKeywords.includes("testing")) {
    questions.push("How do you usually validate quality, correctness, or reliability when you ship code?");
  }

  return questions.slice(0, 4);
}

function buildMarkdownTable(
  rows: Array<{
    title: string;
    company: string | null;
    location: string | null;
    matchedKeywords: string[];
    score: number;
    note: string;
  }>,
): string {
  const header = "| Role | Org | Location | Score | Matched keywords | Note |\n| --- | --- | --- | --- | --- | --- |";
  const body = rows.map((row) =>
    `| ${row.title} | ${row.company ?? "-"} | ${row.location ?? "-"} | ${row.score} | ${row.matchedKeywords.slice(0, 6).join(", ") || "-"} | ${row.note.replace(/\|/g, "/")} |`,
  );

  return [header, ...body].join("\n");
}

function highlightLineHtml(line: string, keywords: string[]): string {
  let html = escapeHtml(line);

  for (const keyword of [...keywords].sort((a, b) => b.length - a.length)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(`(${escaped})`, "gi"),
      "<mark>$1</mark>",
    );
  }

  return html;
}

function buildAnnotatedHtml(args: {
  fileName: string;
  recruiterTake: string[];
  candidateTake: string[];
  interviewQuestions: string[];
  highlightedLines: Array<{ line: string; keywords: string[] }>;
  localRows: Array<{
    title: string;
    company: string | null;
    location: string | null;
    matchedKeywords: string[];
    score: number;
    note: string;
  }>;
  internetRows: Array<{
    title: string;
    company: string | null;
    location: string | null;
    matchedKeywords: string[];
    score: number;
    note: string;
    url?: string;
  }>;
}) {
  const highlightedSections = args.highlightedLines
    .map(
      (item, index) => `
        <section class="line-card">
          <div class="line-meta">Highlight ${index + 1} · ${item.keywords.join(", ")}</div>
          <div class="line-text">${highlightLineHtml(item.line, item.keywords)}</div>
        </section>`,
    )
    .join("\n");

  const localRows = args.localRows
    .map(
      (row) => `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.company ?? "-")}</td><td>${escapeHtml(row.location ?? "-")}</td><td>${row.score}</td><td>${escapeHtml(row.matchedKeywords.slice(0, 6).join(", ") || "-")}</td><td>${escapeHtml(row.note)}</td></tr>`,
    )
    .join("");

  const internetRows = args.internetRows
    .map(
      (row) => `<tr><td>${row.url ? `<a href="${escapeHtml(row.url)}">${escapeHtml(row.title)}</a>` : escapeHtml(row.title)}</td><td>${escapeHtml(row.company ?? "-")}</td><td>${escapeHtml(row.location ?? "-")}</td><td>${row.score}</td><td>${escapeHtml(row.matchedKeywords.slice(0, 6).join(", ") || "-")}</td><td>${escapeHtml(row.note)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(args.fileName)} · Resume Review</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f5ef;
        --card: #fffdf8;
        --ink: #18221f;
        --muted: #5c6a62;
        --accent: #2c6e49;
        --accent-soft: #dff1e7;
        --line: #d9d4c7;
        --mark: #ffe58f;
      }
      body { font-family: Georgia, "Times New Roman", serif; margin: 0; background: linear-gradient(180deg, #f7f5ef 0%, #ece8db 100%); color: var(--ink); }
      .page { max-width: 1100px; margin: 32px auto; padding: 0 20px 40px; }
      .hero { background: var(--card); border: 1px solid var(--line); border-radius: 24px; padding: 28px; box-shadow: 0 18px 40px rgba(24, 34, 31, 0.08); }
      h1, h2 { margin: 0 0 12px; font-family: "Trebuchet MS", "Avenir Next", sans-serif; }
      .grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; margin-top: 20px; }
      .card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 20px; box-shadow: 0 12px 30px rgba(24, 34, 31, 0.05); }
      ul { margin: 10px 0 0 20px; }
      li { margin-bottom: 8px; }
      mark { background: var(--mark); padding: 0 2px; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; font-family: "Avenir Next", "Trebuchet MS", sans-serif; font-size: 14px; }
      th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }
      th { background: var(--accent-soft); }
      .line-card { border: 1px solid var(--line); border-radius: 16px; padding: 14px; background: #fffefa; margin-bottom: 12px; }
      .line-meta { font: 600 12px/1.4 "Avenir Next", sans-serif; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
      .line-text { font-size: 16px; line-height: 1.6; }
      .stack { display: grid; gap: 16px; }
      .muted { color: var(--muted); font-family: "Avenir Next", sans-serif; }
      a { color: var(--accent); }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <h1>Resume Review Bundle</h1>
        <div class="muted">${escapeHtml(args.fileName)} · recruiter + candidate readout with highlighted evidence</div>
      </div>

      <div class="grid">
        <div class="stack">
          <section class="card">
            <h2>Recruiter View</h2>
            <ul>${args.recruiterTake.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>

          <section class="card">
            <h2>Candidate View</h2>
            <ul>${args.candidateTake.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>

          <section class="card">
            <h2>Highlighted Resume Evidence</h2>
            ${highlightedSections}
          </section>
        </div>

        <div class="stack">
          <section class="card">
            <h2>Interview Questions</h2>
            <ul>${args.interviewQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>

          <section class="card">
            <h2>Best-Fit Internal Roles</h2>
            <table>
              <thead><tr><th>Role</th><th>Org</th><th>Location</th><th>Score</th><th>Keywords</th><th>Note</th></tr></thead>
              <tbody>${localRows}</tbody>
            </table>
          </section>

          <section class="card">
            <h2>Internet Roles</h2>
            <table>
              <thead><tr><th>Role</th><th>Org</th><th>Location</th><th>Score</th><th>Keywords</th><th>Note</th></tr></thead>
              <tbody>${internetRows}</tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function buildOpenClawResumeReview(input: ResumeReviewInput): Promise<{
  discordSummary: string;
  promptBlock: string;
  markdownReport: string;
  htmlReport: string;
  fileBaseName: string;
}> {
  const resumeText = input.resumeText.trim();
  const fileBaseName = (input.fileName?.replace(/\.pdf$/i, "") || "resume-review")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const roleRows: RoleJobRow[] = await db
    .select({
      id: jobRoles.id,
      title: jobRoles.title,
      department: jobRoles.department,
      status: jobRoles.status,
      mustHaveSkills: jobRoles.mustHaveSkills,
      niceToHaveSkills: jobRoles.niceToHaveSkills,
      jobDescription: jobRoles.jobDescription,
      eventName: events.name,
      eventLocation: events.location,
    })
    .from(jobRoles)
    .leftJoin(events, eq(jobRoles.eventId, events.id));

  const localJobs: ApplyAgentJob[] = roleRows.map((role) => ({
    jobId: role.id,
    title: role.title,
    company: role.eventName ?? "AI Hire AI",
    location: role.eventLocation,
    url: "",
    description: buildLocalRoleDescription(role),
    source: "simplify",
  }));

  const localMatch = rankJobsByKeyword({
    resumeText,
    jobs: localJobs,
    threshold: 2,
  });

  const simplifyJobs = await fetchSimplifySummer2026Jobs(10);
  let keywordPhase = rankJobsByKeyword({
    resumeText,
    jobs: simplifyJobs,
    threshold: 3,
  });

  let sourceUsed: "simplify" | "serpapi" = "simplify";
  if (keywordPhase.recommendedJobs.length === 0) {
    sourceUsed = "serpapi";
    const serpJobs = await fetchSerpApiJobs({
      queries: ["software engineer intern", "ai engineer intern", "machine learning engineer intern", "data engineer intern", "full stack engineer intern"],
      limit: 10,
    });
    keywordPhase = rankJobsByKeyword({
      resumeText,
      jobs: serpJobs,
      threshold: 3,
    });
  }

  const internetRanked = await rerankJobsWithBedrock({
    resumeText,
    jobs:
      keywordPhase.recommendedJobs.length > 0
        ? keywordPhase.recommendedJobs
        : keywordPhase.rankedJobs.slice(0, 8),
    threshold: 3,
  });

  const matchedKeywords = unique([
    ...localMatch.resumeKeywords,
    ...keywordPhase.resumeKeywords,
  ]).slice(0, 20);

  const resumeLines = splitResumeLines(resumeText);
  const highlightedLines = resumeLines
    .map((line) => ({
      line,
      keywords: findKeywordsInText(line, matchedKeywords),
      metricCount: countMetrics(line),
    }))
    .filter((item) => looksLikeBullet(item.line) && item.keywords.length > 0)
    .sort(
      (a, b) =>
        b.keywords.length - a.keywords.length || b.metricCount - a.metricCount,
    )
    .slice(0, 8)
    .map(({ line, keywords }) => ({ line, keywords }));

  const topLocalRole = localMatch.rankedJobs[0];
  const preferredRoleTitle = inferPreferredRoleTitle(input.message, topLocalRole?.title);
  const recruiterTake = buildRecruiterTake(highlightedLines, matchedKeywords, topLocalRole);
  const candidateTake = buildCandidateTake(highlightedLines, matchedKeywords, preferredRoleTitle);
  const interviewQuestions = buildInterviewQuestions(topLocalRole, matchedKeywords);

  const localRows = localMatch.rankedJobs.slice(0, 5).map((job) => {
    const role = roleRows.find((item) => item.id === job.jobId);
    return {
      title: job.title,
      company: role?.eventName ?? "AI Hire AI",
      location: role?.eventLocation ?? null,
      matchedKeywords: job.matchedKeywords,
      score: job.keywordScore,
      note: role?.status
        ? `${job.reason} Internal role status: ${role.status}.`
        : job.reason,
    };
  });

  const internetRows = internetRanked.slice(0, 5).map((job: BedrockRankedJob) => ({
    title: job.title,
    company: job.company,
    location: job.location,
    matchedKeywords: job.matchedKeywords,
    score: job.aiScore,
    note: job.aiReason,
    url: job.url,
  }));

  const markdownReport = [
    `# Resume review: ${fileBaseName}`,
    "",
    "## Recruiter view",
    ...recruiterTake.map((item) => `- ${item}`),
    "",
    "## Candidate view",
    ...candidateTake.map((item) => `- ${item}`),
    "",
    "## Highlighted resume lines",
    ...highlightedLines.map((item) => `- **${item.keywords.join(", ")}** — ${item.line}`),
    "",
    "## Interview questions",
    ...interviewQuestions.map((item) => `- ${item}`),
    "",
    "## Best-fit internal roles",
    buildMarkdownTable(localRows),
    "",
    `## Internet roles (${sourceUsed})`,
    buildMarkdownTable(internetRows),
  ].join("\n");

  const htmlReport = buildAnnotatedHtml({
    fileName: input.fileName || `${fileBaseName}.pdf`,
    recruiterTake,
    candidateTake,
    interviewQuestions,
    highlightedLines,
    localRows,
    internetRows,
  });

  const promptBlock = [
    "Uploaded resume review context:",
    `- File: ${input.fileName || `${fileBaseName}.pdf`}`,
    `- Resume keywords: ${matchedKeywords.join(", ") || "none found"}`,
    `- Preferred role framing: ${preferredRoleTitle}`,
    "- Recruiter take:",
    ...recruiterTake.map((item) => `  - ${item}`),
    "- Candidate take:",
    ...candidateTake.map((item) => `  - ${item}`),
    "- Highlighted resume lines:",
    ...highlightedLines.map((item) => `  - [${item.keywords.join(", ")}] ${item.line}`),
    "- Best-fit internal roles:",
    ...localRows.map((row) => `  - ${row.title} | score ${row.score} | keywords ${row.matchedKeywords.join(", ") || "none"} | ${row.note}`),
    "- Best-fit internet roles:",
    ...internetRows.map((row) => `  - ${row.title} at ${row.company ?? "unknown"} | score ${row.score} | keywords ${row.matchedKeywords.join(", ") || "none"} | ${row.note}${row.url ? ` | ${row.url}` : ""}`),
    "- Resume text:",
    clip(resumeText, 12000) ?? "",
  ].join("\n");

  const discordSummary = [
    `I reviewed **${input.fileName || "that resume"}** and pulled real fit signals from the PDF text.`,
    "",
    `**Recruiter take**`,
    ...recruiterTake.slice(0, 3).map((item) => `- ${item}`),
    "",
    `**Candidate take**`,
    ...candidateTake.slice(0, 3).map((item) => `- ${item}`),
    "",
    `**Best-fit roles**`,
    ...localRows.slice(0, 3).map((row) => `- internal: **${row.title}** (${row.score}) · ${row.matchedKeywords.slice(0, 5).join(", ") || "general fit"}`),
    ...internetRows.slice(0, 3).map((row) => `- internet: **${row.title}** at **${row.company ?? "unknown"}** (${row.score}) · ${row.matchedKeywords.slice(0, 5).join(", ") || "general fit"}`),
    "",
    "I also attached an annotated review bundle so you can skim highlights, notes, and role tables fast.",
  ].join("\n");

  return {
    discordSummary,
    promptBlock,
    markdownReport,
    htmlReport,
    fileBaseName,
  };
}
