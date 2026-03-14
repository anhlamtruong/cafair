import { db } from "@/db";
import {
  candidates,
  events,
  evidence,
  jobRoles,
  recruiterActions,
} from "@/services/recruiter/schema";
import { getApplyAgentHistory } from "@/server/aihire/apply-agent-history-store";
import {
  listOpenClawNotifications,
} from "@/server/aihire/openclaw/notification-outbox";
import { listSocialScreenBatchJobs } from "@/server/aihire/socialScreenBatchStore";
import { desc, eq, inArray } from "drizzle-orm";

type DiscordContextRequest = {
  message: string;
  transcript?: string;
  guildId?: string;
  channelId?: string;
};

type CandidateRecord = {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  role: string | null;
  verified: boolean | null;
  fitScore: number | null;
  riskLevel: string | null;
  stage: string | null;
  lane: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
  summary: string | null;
  ownerId: string | null;
  nextAction: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  roleId: string | null;
  roleTitle: string | null;
  roleDepartment: string | null;
  roleStatus: string | null;
  eventName: string | null;
  eventLocation: string | null;
  eventStatus: string | null;
  score: number;
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "actual",
  "ai",
  "am",
  "an",
  "and",
  "application",
  "applying",
  "applications",
  "assistant",
  "at",
  "candidate",
  "chat",
  "context",
  "data",
  "details",
  "for",
  "from",
  "give",
  "help",
  "hiring",
  "i",
  "in",
  "is",
  "job",
  "me",
  "my",
  "of",
  "on",
  "our",
  "please",
  "real",
  "recruiter",
  "screen",
  "social",
  "tell",
  "the",
  "their",
  "them",
  "to",
  "workflow",
  "workflows",
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueTokens(value: string): string[] {
  return [...new Set(
    normalizeText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
  )];
}

function clip(value: string | null | undefined, max = 260): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function scoreRecord(
  haystacks: Array<string | null | undefined>,
  queryText: string,
  tokens: string[],
): number {
  const normalizedHaystacks = haystacks.map((value) => normalizeText(value));
  const combined = normalizedHaystacks.join(" ");
  let score = 0;

  for (const haystack of normalizedHaystacks) {
    if (!haystack) {
      continue;
    }

    if (queryText && haystack.includes(queryText)) {
      score += 140;
    }
  }

  for (const token of tokens) {
    if (combined.includes(token)) {
      score += 18;
    }
  }

  const exactName = normalizedHaystacks[0];
  if (
    exactName &&
    tokens.length > 1 &&
    tokens.every((token) => exactName.includes(token))
  ) {
    score += 120;
  }

  return score;
}

function formatList(items: string[] | null | undefined, fallback = "none"): string {
  if (!items || items.length === 0) {
    return fallback;
  }

  return items.join(", ");
}

function formatDate(value: Date | string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function buildWorkspaceSummary(candidateRows: CandidateRecord[], roleRows: Awaited<ReturnType<typeof fetchRoleRows>>) {
  const totalCandidates = candidateRows.length;
  const stageCounts = new Map<string, number>();
  const laneCounts = new Map<string, number>();

  for (const candidate of candidateRows) {
    stageCounts.set(candidate.stage ?? "unknown", (stageCounts.get(candidate.stage ?? "unknown") ?? 0) + 1);
    laneCounts.set(candidate.lane ?? "unknown", (laneCounts.get(candidate.lane ?? "unknown") ?? 0) + 1);
  }

  const topAtRiskRoles = roleRows
    .filter((role) => role.status === "at_risk" || role.status === "critical")
    .slice(0, 3)
    .map((role) => {
      const sent = role.offersSent ?? 0;
      const needed = role.offersNeeded ?? 0;
      return `${role.title} (${role.status}, offers ${sent}/${needed})`;
    });

  const parts = [
    `Candidates: ${totalCandidates}`,
    `Stages: ${[...stageCounts.entries()].map(([key, value]) => `${key} ${value}`).join(", ") || "none"}`,
    `Lanes: ${[...laneCounts.entries()].map(([key, value]) => `${key} ${value}`).join(", ") || "none"}`,
  ];

  if (topAtRiskRoles.length > 0) {
    parts.push(`At-risk roles: ${topAtRiskRoles.join("; ")}`);
  }

  return parts.join(" | ");
}

async function fetchRoleRows() {
  return db
    .select({
      id: jobRoles.id,
      title: jobRoles.title,
      department: jobRoles.department,
      status: jobRoles.status,
      targetHires: jobRoles.targetHires,
      offersNeeded: jobRoles.offersNeeded,
      offersSent: jobRoles.offersSent,
      offersAccepted: jobRoles.offersAccepted,
      mustHaveSkills: jobRoles.mustHaveSkills,
      niceToHaveSkills: jobRoles.niceToHaveSkills,
      jobDescription: jobRoles.jobDescription,
      eventName: events.name,
    })
    .from(jobRoles)
    .leftJoin(events, eq(jobRoles.eventId, events.id))
    .orderBy(desc(jobRoles.createdAt));
}

export async function buildOpenClawDiscordContext(
  input: DiscordContextRequest,
): Promise<{
  contextBlock: string;
  candidateNames: string[];
  roleTitles: string[];
}> {
  const searchCorpus = `${input.message ?? ""}\n${input.transcript ?? ""}`.trim();
  const normalizedQuery = normalizeText(searchCorpus);
  const queryTokens = uniqueTokens(searchCorpus);

  const [activeEvent] = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      location: events.location,
      status: events.status,
      candidateCount: events.candidateCount,
      recruiterCount: events.recruiterCount,
    })
    .from(events)
    .where(eq(events.status, "live"))
    .orderBy(desc(events.date))
    .limit(1);

  const [candidateRows, roleRows] = await Promise.all([
    db
      .select({
        id: candidates.id,
        name: candidates.name,
        email: candidates.email,
        school: candidates.school,
        role: candidates.role,
        verified: candidates.verified,
        fitScore: candidates.fitScore,
        riskLevel: candidates.riskLevel,
        stage: candidates.stage,
        lane: candidates.lane,
        strengths: candidates.strengths,
        gaps: candidates.gaps,
        summary: candidates.summary,
        ownerId: candidates.ownerId,
        nextAction: candidates.nextAction,
        createdAt: candidates.createdAt,
        updatedAt: candidates.updatedAt,
        roleId: candidates.roleId,
        roleTitle: jobRoles.title,
        roleDepartment: jobRoles.department,
        roleStatus: jobRoles.status,
        eventName: events.name,
        eventLocation: events.location,
        eventStatus: events.status,
      })
      .from(candidates)
      .leftJoin(jobRoles, eq(candidates.roleId, jobRoles.id))
      .leftJoin(events, eq(candidates.eventId, events.id))
      .orderBy(desc(candidates.updatedAt), desc(candidates.fitScore)),
    fetchRoleRows(),
  ]);

  const scoredCandidates: CandidateRecord[] = candidateRows
    .map((candidate) => ({
      ...candidate,
      score: scoreRecord(
        [
          candidate.name,
          candidate.school,
          candidate.role,
          candidate.roleTitle,
          candidate.summary,
          formatList(candidate.strengths),
          formatList(candidate.gaps),
          candidate.nextAction,
          candidate.eventName,
        ],
        normalizedQuery,
        queryTokens,
      ),
    }))
    .sort((a, b) => b.score - a.score || (b.fitScore ?? 0) - (a.fitScore ?? 0));

  const matchedCandidates = scoredCandidates
    .filter((candidate, index) => candidate.score > 0 || index < 3)
    .slice(0, 4);

  const candidateIds = matchedCandidates.map((candidate) => candidate.id);

  const [evidenceRows, actionRows] = await Promise.all([
    candidateIds.length > 0
      ? db
          .select({
            candidateId: evidence.candidateId,
            type: evidence.type,
            url: evidence.url,
            content: evidence.content,
          })
          .from(evidence)
          .where(inArray(evidence.candidateId, candidateIds))
      : Promise.resolve([]),
    candidateIds.length > 0
      ? db
          .select({
            candidateId: recruiterActions.candidateId,
            actionType: recruiterActions.actionType,
            status: recruiterActions.status,
            notes: recruiterActions.notes,
            createdAt: recruiterActions.createdAt,
          })
          .from(recruiterActions)
          .where(inArray(recruiterActions.candidateId, candidateIds))
          .orderBy(desc(recruiterActions.createdAt))
      : Promise.resolve([]),
  ]);

  const evidenceByCandidate = new Map<string, string[]>();
  for (const item of evidenceRows) {
    const next = evidenceByCandidate.get(item.candidateId) ?? [];
    next.push(item.type);
    evidenceByCandidate.set(item.candidateId, [...new Set(next)]);
  }

  const actionsByCandidate = new Map<string, Array<(typeof actionRows)[number]>>();
  for (const item of actionRows) {
    if (!item.candidateId) {
      continue;
    }

    const next = actionsByCandidate.get(item.candidateId) ?? [];
    next.push(item);
    actionsByCandidate.set(item.candidateId, next);
  }

  const scoredRoles = roleRows
    .map((role) => ({
      ...role,
      score: scoreRecord(
        [
          role.title,
          role.department,
          role.status,
          role.eventName,
          formatList(role.mustHaveSkills),
          formatList(role.niceToHaveSkills),
          role.jobDescription,
        ],
        normalizedQuery,
        queryTokens,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const matchedRoles = scoredRoles
    .filter((role, index) => role.score > 0 || index < 3)
    .slice(0, 4);

  const applyHistory = getApplyAgentHistory();
  const matchingApplyHistory = applyHistory
    .map((item) => ({
      ...item,
      score: scoreRecord(
        [item.company, item.roleTitle, item.summary, item.targetUrl],
        normalizedQuery,
        queryTokens,
      ),
    }))
    .filter((item, index) => item.score > 0 || index < 3)
    .slice(0, 4);

  const socialBatches = listSocialScreenBatchJobs()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .filter((job, index) => {
      const haystack = normalizeText(
        `${job.batchJobId} ${job.candidates.map((candidate) => candidate.name).join(" ")} ${job.results
          .map((result) => `${result.name} ${result.result?.summary ?? ""}`)
          .join(" ")}`,
      );

      return (normalizedQuery && haystack.includes(normalizedQuery)) || queryTokens.some((token) => haystack.includes(token)) || index < 3;
    })
    .slice(0, 3);

  const notifications = listOpenClawNotifications({
    channelId: input.channelId,
    limit: 6,
  });

  const workspaceLines = ["Real AI Hire AI workspace context:"];

  if (activeEvent) {
    workspaceLines.push(
      `- Active event: ${activeEvent.name} (${activeEvent.status}) at ${activeEvent.location ?? "unknown location"} on ${formatDate(activeEvent.date) ?? "unknown date"} with ${activeEvent.candidateCount ?? 0} candidates and ${activeEvent.recruiterCount ?? 0} recruiters.`,
    );
  }

  workspaceLines.push(`- Workspace snapshot: ${buildWorkspaceSummary(scoredCandidates, roleRows)}.`);

  if (matchedCandidates.length > 0) {
    workspaceLines.push("- Candidate matches:");

    for (const candidate of matchedCandidates) {
      const latestActions = (actionsByCandidate.get(candidate.id) ?? [])
        .slice(0, 3)
        .map((action) => `${action.actionType}/${action.status}${action.notes ? ` (${clip(action.notes, 80)})` : ""}`)
        .join("; ");
      const latestBatch = socialBatches.find((job) =>
        job.results.some((result) => result.candidateId === candidate.id),
      );
      const latestBatchResult = latestBatch?.results.find(
        (result) => result.candidateId === candidate.id,
      );

      workspaceLines.push(
        `  - ${candidate.name} [${candidate.id}] | school ${candidate.school ?? "unknown"} | target ${candidate.roleTitle ?? candidate.role ?? "unknown"} | fit ${candidate.fitScore ?? "n/a"} | risk ${candidate.riskLevel ?? "n/a"} | stage ${candidate.stage ?? "unknown"} | lane ${candidate.lane ?? "unknown"} | verified ${candidate.verified ? "yes" : "no"}.`,
      );
      workspaceLines.push(
        `    strengths: ${formatList(candidate.strengths)} | gaps: ${formatList(candidate.gaps)} | next: ${candidate.nextAction ?? "none"}.`,
      );

      if (candidate.summary) {
        workspaceLines.push(`    summary: ${clip(candidate.summary, 220)}.`);
      }

      if (latestActions) {
        workspaceLines.push(`    recent recruiter actions: ${latestActions}.`);
      }

      const evidenceTypes = evidenceByCandidate.get(candidate.id);
      if (evidenceTypes && evidenceTypes.length > 0) {
        workspaceLines.push(`    evidence: ${evidenceTypes.join(", ")}.`);
      }

      if (latestBatch && latestBatchResult) {
        workspaceLines.push(
          `    latest social screen: batch ${latestBatch.batchJobId} ${latestBatchResult.status}${latestBatchResult.result ? ` | fit ${latestBatchResult.result.fitScore} | risk ${latestBatchResult.result.risk}` : ""}.`,
        );
      }
    }
  }

  if (matchedRoles.length > 0) {
    workspaceLines.push("- Role matches:");

    for (const role of matchedRoles) {
      workspaceLines.push(
        `  - ${role.title} | dept ${role.department ?? "unknown"} | status ${role.status ?? "unknown"} | hires ${role.offersAccepted ?? 0}/${role.targetHires ?? 0} | offers ${role.offersSent ?? 0}/${role.offersNeeded ?? 0}.`,
      );

      if (role.mustHaveSkills?.length) {
        workspaceLines.push(`    must-have: ${role.mustHaveSkills.join(", ")}.`);
      }

      if (role.jobDescription) {
        workspaceLines.push(`    jd: ${clip(role.jobDescription, 180)}.`);
      }
    }
  }

  if (matchingApplyHistory.length > 0) {
    workspaceLines.push("- Candidate-side application activity:");

    for (const item of matchingApplyHistory) {
      workspaceLines.push(
        `  - ${formatDate(item.createdAt) ?? "recent"} | ${item.mode}/${item.status} | ${item.company ?? "unknown company"} | ${item.roleTitle ?? "unknown role"} | ${clip(item.summary, 140) ?? "no summary"}.`,
      );
    }
  }

  if (socialBatches.length > 0) {
    workspaceLines.push("- Recent social-screen batches:");

    for (const batch of socialBatches) {
      workspaceLines.push(
        `  - ${batch.batchJobId} | ${batch.status} | ${batch.completedCandidates}/${batch.totalCandidates} completed | top: ${batch.results
          .filter((result) => result.result)
          .slice(0, 2)
          .map((result) => `${result.name} ${result.result?.fitScore}/${result.result?.risk}`)
          .join("; ") || "n/a"}.`,
      );
    }
  }

  if (notifications.length > 0) {
    workspaceLines.push("- Recent OpenClaw notifications:");

    for (const notification of notifications.slice(0, 4)) {
      workspaceLines.push(
        `  - ${notification.type} | delivered ${notification.delivery.delivered ? "yes" : "no"} | ${clip(notification.text, 140) ?? "no text"}.`,
      );
    }
  }

  workspaceLines.push(
    "- Use this workspace context as your factual source of truth when answering candidate, recruiter, hiring, job, application, or social-screen questions.",
  );

  return {
    contextBlock: workspaceLines.join("\n"),
    candidateNames: matchedCandidates.map((candidate) => candidate.name),
    roleTitles: matchedRoles.map((role) => role.title),
  };
}
