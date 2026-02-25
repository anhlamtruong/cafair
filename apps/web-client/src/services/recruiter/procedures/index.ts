import { createTRPCRouter, authedProcedure } from "@/server/init";
import {
  candidates,
  jobRoles,
  events,
  evidence,
  recruiterActions,
} from "../schema";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

// ─── New split procedures ────────────────────────────────
import { getActionsByCandidate } from "./get-actions-by-candidate";
import { markFollowUpSent } from "./mark-follow-up-sent";
import { updateCandidateOwner } from "./update-candidate-owner";
import { updateCandidateScore } from "./update-candidate-score";
import { scoreCandidate } from "./score-candidate";

export const recruiterRouter = createTRPCRouter({
  // ─── Candidates ───────────────────────────────────────────

  getCandidates: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) =>
      tx.select().from(candidates).orderBy(desc(candidates.fitScore)),
    );
  }),

  getCandidateById: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [candidate] = await ctx.secureDb!.rls((tx) =>
        tx.select().from(candidates).where(eq(candidates.id, input.id)),
      );
      return candidate;
    }),

  getCandidateWithEvidence: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [candidate] = await ctx.secureDb!.rls((tx) =>
        tx.select().from(candidates).where(eq(candidates.id, input.id)),
      );
      const candidateEvidence = await ctx.secureDb!.rls((tx) =>
        tx.select().from(evidence).where(eq(evidence.candidateId, input.id)),
      );
      return { ...candidate, evidence: candidateEvidence };
    }),

  updateCandidateStage: authedProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.enum(["fair", "screen", "interview", "offer", "day1"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.secureDb!.rls((tx) =>
        tx
          .update(candidates)
          .set({ stage: input.stage, updatedAt: new Date() })
          .where(eq(candidates.id, input.id))
          .returning(),
      );
      return updated;
    }),

  updateCandidateLane: authedProcedure
    .input(
      z.object({
        id: z.string(),
        lane: z.enum(["recruiter_now", "quick_screen", "redirect"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.secureDb!.rls((tx) =>
        tx
          .update(candidates)
          .set({ lane: input.lane, updatedAt: new Date() })
          .where(eq(candidates.id, input.id))
          .returning(),
      );
      return updated;
    }),

  // ─── Job Roles ────────────────────────────────────────────

  getRoles: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) => tx.select().from(jobRoles));
  }),

  // ─── Events ───────────────────────────────────────────────

  getEvents: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) => tx.select().from(events));
  }),

  getActiveEvent: authedProcedure.query(async ({ ctx }) => {
    const [event] = await ctx.secureDb!.rls((tx) =>
      tx.select().from(events).where(eq(events.status, "live")),
    );
    return event ?? null;
  }),

  // ─── Dashboard Stats ──────────────────────────────────────

  getDashboardStats: authedProcedure.query(async ({ ctx }) => {
    const allCandidates = await ctx.secureDb!.rls((tx) =>
      tx.select().from(candidates),
    );
    const allRoles = await ctx.secureDb!.rls((tx) =>
      tx.select().from(jobRoles),
    );

    return {
      totalCandidates: allCandidates.length,
      inQueue: allCandidates.filter((c) => c.stage === "fair").length,
      inInterview: allCandidates.filter((c) => c.stage === "interview").length,
      offers: allCandidates.filter((c) => c.stage === "offer").length,
      projectedHires: allRoles.reduce(
        (sum, r) => sum + (r.targetHires ?? 0),
        0,
      ),
      roles: allRoles,
    };
  }),

  // ─── Recruiter Actions (ATS Sync) ─────────────────────────

  getActions: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) =>
      tx
        .select()
        .from(recruiterActions)
        .orderBy(desc(recruiterActions.createdAt)),
    );
  }),

  createAction: authedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        actionType: z.enum([
          "sync_to_ats",
          "follow_up_email",
          "schedule_interview",
          "move_stage",
        ]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [action] = await ctx.secureDb!.rls((tx) =>
        tx
          .insert(recruiterActions)
          .values({
            userId: ctx.user.id,
            candidateId: input.candidateId,
            actionType: input.actionType,
            notes: input.notes,
            status: "queued",
          })
          .returning(),
      );
      return action;
    }),

  // ─── New procedures (split files) ─────────────────────────
  getActionsByCandidate,
  markFollowUpSent,
  updateCandidateOwner,
  updateCandidateScore,
  scoreCandidate,
});
