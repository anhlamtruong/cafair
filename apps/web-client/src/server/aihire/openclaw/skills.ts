import { z } from "zod";
import {
  buildCandidatePacket,
  runTriage,
  toAtsUpdatePayload,
} from "../../../../../agents/src";
import { getSocialScreen } from "@/server/aihire/social-screen";
import {
  getOpenClawSocialScreenBatchStatus,
  getOpenClawSocialScreenBatchSummary,
  startOpenClawSocialScreenBatch,
} from "./social-screen-batch-notifier";

export const OPENCLAW_SKILL_NAMES = [
  "social_screen_batch.start",
  "social_screen_batch.status",
  "social_screen_batch.summary",
  "triage_candidate",
  "social_screen_candidate",
  "candidate_packet.build",
  "recruiter_actions.draft",
] as const;

export type OpenClawSkillName = (typeof OPENCLAW_SKILL_NAMES)[number];

const openClawSkillNameSchema = z.enum(OPENCLAW_SKILL_NAMES);

const notificationTargetSchema = z
  .object({
    webhookUrl: z.string().url().optional(),
    channelId: z.string().optional(),
    conversationId: z.string().optional(),
    actorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

const batchCandidateSchema = z.object({
  candidateId: z.string().optional(),
  name: z.string().optional(),
  roleTitle: z.string().optional(),
  school: z.string().optional(),
  resumeText: z.string().optional(),
});

const batchStartSchema = z.object({
  candidates: z.array(batchCandidateSchema).min(1),
  notify: notificationTargetSchema,
  pollIntervalMs: z.number().int().positive().max(10_000).optional(),
  timeoutMs: z.number().int().positive().max(600_000).optional(),
});

const batchJobIdSchema = z.object({
  batchJobId: z.string().min(1),
});

const roleProfileSchema = z.object({
  roleId: z.string().min(1),
  roleName: z.string().min(1),
  jobDescriptionText: z.string().optional(),
  mustHaveKeywords: z.array(z.string()).optional(),
  niceToHaveKeywords: z.array(z.string()).optional(),
  weights: z
    .object({
      keywordMatch: z.number().optional(),
      mustHave: z.number().optional(),
      recencySignal: z.number().optional(),
    })
    .optional(),
  thresholds: z
    .object({
      recruiterNow: z.number().optional(),
      quickScreen: z.number().optional(),
    })
    .optional(),
});

const candidateArtifactsSchema = z.object({
  resumeText: z.string().optional(),
  essayText: z.string().optional(),
  transcriptText: z.string().optional(),
  portfolioText: z.string().optional(),
  linkedinText: z.string().optional(),
  githubText: z.string().optional(),
  googleText: z.string().optional(),
});

const triageInputSchema = z.object({
  candidateId: z.string().min(1),
  candidateName: z.string().optional(),
  role: roleProfileSchema,
  artifacts: candidateArtifactsSchema,
});

const candidatePacketInputSchema = triageInputSchema.extend({
  roleName: z.string().optional(),
  companyName: z.string().optional(),
  side: z.enum(["candidate", "recruiter"]).optional(),
  enableMicroScreen: z.boolean().optional(),
  microScreenMinChars: z.number().int().positive().optional(),
});

const socialScreenCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
    name: z.string().optional(),
    candidateName: z.string().optional(),
    roleTitle: z.string().optional(),
    school: z.string().optional(),
    resumeText: z.string().optional(),
    linkedin: z
      .object({
        url: z.string().optional(),
        headline: z.string().optional(),
        currentCompany: z.string().optional(),
        school: z.string().optional(),
        skills: z.array(z.string()).optional(),
        experiences: z
          .array(
            z.object({
              title: z.string().optional(),
              company: z.string().optional(),
              start: z.string().optional(),
              end: z.string().optional(),
              description: z.string().optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    github: z
      .object({
        url: z.string().optional(),
        username: z.string().optional(),
        displayName: z.string().optional(),
        bio: z.string().optional(),
        followers: z.number().optional(),
        following: z.number().optional(),
        contributionsLastYear: z.number().optional(),
        pinnedRepos: z
          .array(
            z.object({
              name: z.string().optional(),
              description: z.string().optional(),
              language: z.string().optional(),
              stars: z.number().optional(),
            }),
          )
          .optional(),
        topLanguages: z.array(z.string()).optional(),
      })
      .optional(),
    web: z
      .object({
        queries: z.array(z.string()).optional(),
        results: z
          .array(
            z.object({
              title: z.string().optional(),
              snippet: z.string().optional(),
              source: z.string().optional(),
              url: z.string().optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    useBedrock: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.name?.trim() && !value.candidateName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Either name or candidateName is required",
      });
    }
  })
  .transform(({ candidateName, name, ...rest }) => ({
    ...rest,
    name: name?.trim() || candidateName?.trim() || "",
  }));

const OPENCLAW_SKILL_DESCRIPTIONS: Record<OpenClawSkillName, string> = {
  "social_screen_batch.start":
    "Create a social-screen batch job, watch it, and emit completion notifications.",
  "social_screen_batch.status":
    "Fetch the latest status for a social-screen batch job.",
  "social_screen_batch.summary":
    "Fetch the recruiter-ready summary for a social-screen batch job.",
  triage_candidate: "Run the recruiter triage agent for a candidate.",
  social_screen_candidate:
    "Run the recruiter social-screen wrapper for a single candidate.",
  "candidate_packet.build":
    "Build the combined triage/verify/microscreen candidate packet.",
  "recruiter_actions.draft":
    "Generate ATS-ready recruiter actions from the candidate packet pipeline.",
};

export function listOpenClawSkills() {
  return OPENCLAW_SKILL_NAMES.map((name) => ({
    name,
    description: OPENCLAW_SKILL_DESCRIPTIONS[name],
  }));
}

export async function runOpenClawSkill(payload: {
  skill: OpenClawSkillName;
  input: unknown;
}) {
  switch (payload.skill) {
    case "social_screen_batch.start": {
      const input = batchStartSchema.parse(payload.input);
      return {
        skill: payload.skill,
        result: await startOpenClawSocialScreenBatch(input),
      };
    }

    case "social_screen_batch.status": {
      const input = batchJobIdSchema.parse(payload.input);
      const result = await getOpenClawSocialScreenBatchStatus(input.batchJobId);

      if (!result) {
        throw new Error(`Batch job not found: ${input.batchJobId}`);
      }

      return {
        skill: payload.skill,
        result,
      };
    }

    case "social_screen_batch.summary": {
      const input = batchJobIdSchema.parse(payload.input);
      const result = await getOpenClawSocialScreenBatchSummary(input.batchJobId);

      if (!result) {
        throw new Error(`Batch job not found: ${input.batchJobId}`);
      }

      return {
        skill: payload.skill,
        result,
      };
    }

    case "triage_candidate": {
      const input = triageInputSchema.parse(payload.input);
      return {
        skill: payload.skill,
        result: runTriage(input),
      };
    }

    case "social_screen_candidate": {
      const input = socialScreenCandidateSchema.parse(payload.input);
      return {
        skill: payload.skill,
        result: await getSocialScreen(input),
      };
    }

    case "candidate_packet.build": {
      const input = candidatePacketInputSchema.parse(payload.input);
      return {
        skill: payload.skill,
        result: buildCandidatePacket(input),
      };
    }

    case "recruiter_actions.draft": {
      const input = candidatePacketInputSchema.parse(payload.input);
      const packet = buildCandidatePacket(input);

      return {
        skill: payload.skill,
        result: toAtsUpdatePayload(packet),
      };
    }
  }
}

export const openClawSkillRequestSchema = z.object({
  skill: openClawSkillNameSchema,
  input: z.unknown(),
});
