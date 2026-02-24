// Path: agents/src/agents/candidatePlan.ts
//
// Candidate-side "Nova Act plan suggestions" (stub-first).
// Produces a step-by-step plan the UI can render (Queued/Running/Success)
// and that can later be executed by Nova Act with the same structure.

export type PlanStatus = "Queued" | "Running" | "Success" | "Failed" | "NeedsApproval";

export type PlanActionType =
  | "CollectPreferences"
  | "FindJobs"
  | "TailorResume"
  | "GenerateMicroScreen"
  | "RequestReferral"
  | "ApplyToJob"
  | "TrackApplication"
  | "FollowUp";

export interface CandidatePreferences {
  roleKeywords?: string[];       // e.g., ["data science", "nlp"]
  locations?: string[];          // e.g., ["Remote", "Boston, MA"]
  remoteOnly?: boolean;
  salaryMin?: number;
  workAuth?: string;             // e.g., "US Citizen", "F-1 OPT"
  excludeCompanies?: string[];
  maxApplicationsPerDay?: number;
}

export interface CandidateProfileLite {
  candidateId: string;
  name?: string;
  gradYear?: number;
  school?: string;
  workAuth?: string;
  resumeText?: string;
  portfolioUrls?: string[];
}

export interface JobTarget {
  jobId: string;
  company: string;
  title: string;
  source: "CareerFair" | "LinkedIn" | "GitHub" | "CompanySite";
  url?: string;
  roleId?: string; // optional internal role mapping
}

export interface PlanStep {
  stepId: string;
  title: string;                 // short UI label
  type: PlanActionType;
  status: PlanStatus;
  requiresApproval: boolean;
  inputs?: Record<string, string | number | boolean | string[]>;
  expectedOutput?: string;       // short description
  notes?: string;                // minimal human-readable explanation
}

export interface CandidateActPlan {
  planId: string;
  candidateId: string;
  createdAtISO: string;
  goal: string;                  // e.g. "Apply to Data Science Intern at Company A"
  steps: PlanStep[];
  suggestions: string[];         // "what else should agent do?"
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function safeLower(s?: string) {
  return (s ?? "").toLowerCase();
}

/**
 * Build a demo-friendly Nova Act plan for a candidate.
 * Use `mode="demo"` to keep steps short and deterministic.
 */
export function buildCandidateActPlan(args: {
  candidate: CandidateProfileLite;
  preferences?: CandidatePreferences;
  targets: JobTarget[];                 // 1..N jobs the candidate wants
  mode?: "demo" | "full";
}): CandidateActPlan {
  const mode = args.mode ?? "demo";
  const { candidate, preferences, targets } = args;

  const goal =
    targets.length === 1
      ? `Apply to ${targets[0].title} at ${targets[0].company}`
      : `Apply to ${targets.length} jobs based on preferences`;

  // Basic suggestions (shown in chatbot)
  const suggestions: string[] = [
    "Ask me to confirm work authorization and location constraints",
    "Tailor my resume to the job description with an approval preview",
    "Draft a referral request message and let me edit before sending",
    "Auto-track application status and remind me to follow up in 3–5 days",
  ];

  const steps: PlanStep[] = [];

  // 1) Preferences (only if missing or incomplete)
  const prefMissing =
    !preferences ||
    (preferences.roleKeywords?.length ?? 0) === 0 ||
    (!preferences.remoteOnly && (preferences.locations?.length ?? 0) === 0);

  if (prefMissing) {
    steps.push({
      stepId: uid("step"),
      title: "Confirm preferences",
      type: "CollectPreferences",
      status: "NeedsApproval",
      requiresApproval: true,
      expectedOutput: "Saved preferences for job matching",
      notes: "Quick check: role keywords, location/remote, salary, work authorization.",
    });
  }

  // 2) Find jobs (optional for demo if targets already selected)
  if (mode === "full") {
    steps.push({
      stepId: uid("step"),
      title: "Find matching jobs",
      type: "FindJobs",
      status: "Queued",
      requiresApproval: false,
      inputs: {
        roleKeywords: preferences?.roleKeywords ?? [],
        remoteOnly: preferences?.remoteOnly ?? false,
        locations: preferences?.locations ?? [],
      },
      expectedOutput: "Ranked list of best-fit jobs",
      notes: "Search across LinkedIn/GitHub/company sites and the fair booths.",
    });
  }

  // 3) For each target job: tailor resume + microscreen + referral + apply + track
  for (const job of targets.slice(0, mode === "demo" ? 1 : targets.length)) {
    steps.push({
      stepId: uid("step"),
      title: `Tailor resume for ${job.company}`,
      type: "TailorResume",
      status: "Queued",
      requiresApproval: true,
      inputs: {
        company: job.company,
        title: job.title,
        source: job.source,
      },
      expectedOutput: "ATS-friendly resume version + diff preview",
      notes: "Highlight matched keywords and suggest edits. Requires approval before saving.",
    });

    steps.push({
      stepId: uid("step"),
      title: "Generate micro-screen",
      type: "GenerateMicroScreen",
      status: "Queued",
      requiresApproval: false,
      inputs: {
        role: job.title,
        company: job.company,
      },
      expectedOutput: "2–3 short questions + transcript capture",
      notes: "Fast questions to capture signal and fill gaps before applying.",
    });

    // referral suggestion: only if job source is LinkedIn/CompanySite OR candidate wants it
    const wantsReferral =
      (preferences?.excludeCompanies?.includes(job.company) ?? false) === false &&
      (job.source === "LinkedIn" || job.source === "CompanySite" || job.source === "CareerFair");

    if (wantsReferral) {
      steps.push({
        stepId: uid("step"),
        title: `Draft referral ask (${job.company})`,
        type: "RequestReferral",
        status: "Queued",
        requiresApproval: true,
        inputs: {
          company: job.company,
          channel: "LinkedIn",
        },
        expectedOutput: "Short referral message + suggested targets",
        notes: "Agent drafts; you review before sending. No messages sent without approval.",
      });
    }

    steps.push({
      stepId: uid("step"),
      title: `Apply (${job.company})`,
      type: "ApplyToJob",
      status: "Queued",
      requiresApproval: true,
      inputs: {
        url: job.url ?? "",
        source: job.source,
        company: job.company,
        title: job.title,
      },
      expectedOutput: "Application submitted + confirmation captured",
      notes: "Nova Act will open the posting, fill fields, upload resume, submit, and save proof.",
    });

    steps.push({
      stepId: uid("step"),
      title: "Track application",
      type: "TrackApplication",
      status: "Queued",
      requiresApproval: false,
      expectedOutput: "Status timeline + reminders",
      notes: "Track submission, response, and follow-up timing.",
    });

    steps.push({
      stepId: uid("step"),
      title: "Follow-up reminder",
      type: "FollowUp",
      status: "Queued",
      requiresApproval: true,
      inputs: {
        daysAfterSubmit: 4,
      },
      expectedOutput: "Draft follow-up message + schedule",
      notes: "Agent drafts a follow-up after 3–5 days; you approve before sending.",
    });
  }

  // Small personalization: if resume text is extremely short, add extra step
  const resumeLen = (candidate.resumeText ?? "").trim().length;
  if (resumeLen > 0 && resumeLen < 120) {
    steps.unshift({
      stepId: uid("step"),
      title: "Improve resume basics",
      type: "TailorResume",
      status: "NeedsApproval",
      requiresApproval: true,
      expectedOutput: "Baseline resume filled with missing essentials",
      notes: "Resume looks thin; agent will suggest bullet structure + measurable impact.",
    });
  }

  // Normalize approvals: Tailor/Referral/Apply/FollowUp always require approval
  const normalized = steps.map((s) => {
    const lower = safeLower(s.title);
    const mustApprove =
      s.type === "TailorResume" || s.type === "RequestReferral" || s.type === "ApplyToJob" || s.type === "FollowUp";
    return {
      ...s,
      requiresApproval: mustApprove ? true : s.requiresApproval,
      status: mustApprove && s.status === "Queued" ? "NeedsApproval" : s.status,
    };
  });

  return {
    planId: uid("plan"),
    candidateId: candidate.candidateId,
    createdAtISO: new Date().toISOString(),
    goal,
    steps: normalized,
    suggestions,
  };
}