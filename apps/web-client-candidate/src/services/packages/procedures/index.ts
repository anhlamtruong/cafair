/**
 * Package Management — tRPC procedures (CRUD + AI parsing)
 *
 * Follows the existing patterns:
 *  - authedProcedure from @/server/init
 *  - ctx.secureDb!.rls(async (tx) => { ... }) for RLS queries
 *  - Zod input validation
 *  - Delete-and-reinsert pattern for child collections
 */

import { authedProcedure, createTRPCRouter } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";

import {
  candidatePackages,
  packageExperiences,
  packageSkills,
  packageEducation,
  packageCertifications,
  packagePreferences,
  packageRoleTargets,
} from "@/db/schema/packages";
import { uploadResume, validateResumeFile } from "@/services/uploads/storage";
import { extractTextFromPdf, parseResume } from "../parsing";
import { users } from "@/services/users/schema";

/* ── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Ensure the Clerk user has a corresponding row in the `users` table.
 * Required because `candidate_packages.user_id` has a FK to `users.id`.
 * Uses `ctx.db` (no RLS) just like `syncFromClerk`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUserExists(ctx: any) {
  const [existing] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);

  if (!existing) {
    await ctx.db.insert(users).values({
      id: ctx.user.id,
      email: ctx.user.emailAddresses?.[0]?.emailAddress ?? "",
      firstName: ctx.user.firstName,
      lastName: ctx.user.lastName,
      imageUrl: ctx.user.imageUrl,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcCompletion(tx: any, packageId: string): Promise<number> {
  let filled = 0;

  const [exp] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(packageExperiences)
    .where(eq(packageExperiences.packageId, packageId));
  if (exp?.count > 0) filled++;

  const [skill] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(packageSkills)
    .where(eq(packageSkills.packageId, packageId));
  if (skill?.count > 0) filled++;

  const [edu] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(packageEducation)
    .where(eq(packageEducation.packageId, packageId));
  if (edu?.count > 0) filled++;

  const [pref] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(packagePreferences)
    .where(eq(packagePreferences.packageId, packageId));
  if (pref?.count > 0) filled++;

  const [target] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(packageRoleTargets)
    .where(eq(packageRoleTargets.packageId, packageId));
  if (target?.count > 0) filled++;

  const percentage = filled * 20;

  await tx
    .update(candidatePackages)
    .set({ completionPercentage: percentage, updatedAt: new Date() })
    .where(eq(candidatePackages.id, packageId));

  return percentage;
}

/* ── Procedures ──────────────────────────────────────────────────────── */

/**
 * List all packages owned by the current user.
 */
export const list = authedProcedure.query(async ({ ctx }) => {
  return ctx.secureDb!.rls(async (tx) => {
    const packages = await tx
      .select()
      .from(candidatePackages)
      .where(eq(candidatePackages.userId, ctx.user.id))
      .orderBy(desc(candidatePackages.updatedAt));

    // For each package, fetch section completion info
    const result = await Promise.all(
      packages.map(async (pkg) => {
        const [expCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(packageExperiences)
          .where(eq(packageExperiences.packageId, pkg.id));
        const [skillCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(packageSkills)
          .where(eq(packageSkills.packageId, pkg.id));
        const [eduCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(packageEducation)
          .where(eq(packageEducation.packageId, pkg.id));
        const [prefCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(packagePreferences)
          .where(eq(packagePreferences.packageId, pkg.id));
        const [targetCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(packageRoleTargets)
          .where(eq(packageRoleTargets.packageId, pkg.id));

        return {
          ...pkg,
          sections: {
            experience: (expCount?.count ?? 0) > 0,
            skills: (skillCount?.count ?? 0) > 0,
            education: (eduCount?.count ?? 0) > 0,
            preferences: (prefCount?.count ?? 0) > 0,
            targets: (targetCount?.count ?? 0) > 0,
          },
        };
      }),
    );

    return result;
  });
});

/**
 * Get a single package with ALL child data.
 */
export const getById = authedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    return ctx.secureDb!.rls(async (tx) => {
      const [pkg] = await tx
        .select()
        .from(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.id),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found",
        });
      }

      const [experiences, skills, education, certifications, preferences, roleTargets] =
        await Promise.all([
          tx
            .select()
            .from(packageExperiences)
            .where(eq(packageExperiences.packageId, input.id))
            .orderBy(packageExperiences.sortOrder),
          tx
            .select()
            .from(packageSkills)
            .where(eq(packageSkills.packageId, input.id))
            .orderBy(packageSkills.sortOrder),
          tx
            .select()
            .from(packageEducation)
            .where(eq(packageEducation.packageId, input.id))
            .orderBy(packageEducation.sortOrder),
          tx
            .select()
            .from(packageCertifications)
            .where(eq(packageCertifications.packageId, input.id))
            .orderBy(packageCertifications.sortOrder),
          tx
            .select()
            .from(packagePreferences)
            .where(eq(packagePreferences.packageId, input.id))
            .limit(1),
          tx
            .select()
            .from(packageRoleTargets)
            .where(eq(packageRoleTargets.packageId, input.id))
            .orderBy(packageRoleTargets.sortOrder),
        ]);

      return {
        ...pkg,
        experiences,
        skills,
        education,
        certifications,
        preferences: preferences[0] ?? null,
        roleTargets,
      };
    });
  });

/**
 * Create a new empty package.
 */
export const create = authedProcedure
  .input(
    z.object({
      title: z.string().min(1).max(255),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Ensure user row exists (FK target for candidate_packages.user_id)
    await ensureUserExists(ctx);

    const [created] = await ctx.secureDb!.rls(async (tx) => {
      return tx
        .insert(candidatePackages)
        .values({
          userId: ctx.user.id,
          title: input.title,
        })
        .returning();
    });
    return created;
  });

/**
 * Upload a resume PDF, parse it with AI, and populate all sections.
 * This is a synchronous long mutation (~5-15s) — no polling needed.
 */
export const uploadAndParse = authedProcedure
  .input(
    z.object({
      packageId: z.string().uuid(),
      base64: z.string(),
      fileName: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // 1. Decode & validate
    const buffer = Buffer.from(input.base64, "base64");
    const mimeType = "application/pdf";
    validateResumeFile(mimeType, buffer.length);

    // 2. Set parseStatus to uploading
    await ctx.secureDb!.rls(async (tx) => {
      await tx
        .update(candidatePackages)
        .set({ parseStatus: "uploading" as const, updatedAt: new Date() })
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        );
    });

    // 3. Upload to Supabase Storage
    const uploadResult = await uploadResume(
      ctx.user.id,
      buffer,
      input.fileName,
      mimeType,
    );

    // 4. Update resume URL and set parsing status
    await ctx.secureDb!.rls(async (tx) => {
      await tx
        .update(candidatePackages)
        .set({
          resumeUrl: uploadResult.url,
          resumeFileName: input.fileName,
          parseStatus: "parsing" as const,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        );
    });

    // 5. Extract text from PDF
    let resumeText: string;
    try {
      resumeText = await extractTextFromPdf(buffer);
    } catch (err) {
      await ctx.secureDb!.rls(async (tx) => {
        await tx
          .update(candidatePackages)
          .set({ parseStatus: "error" as const, updatedAt: new Date() })
          .where(eq(candidatePackages.id, input.packageId));
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to extract text from PDF: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    if (!resumeText || resumeText.length < 50) {
      await ctx.secureDb!.rls(async (tx) => {
        await tx
          .update(candidatePackages)
          .set({ parseStatus: "error" as const, updatedAt: new Date() })
          .where(eq(candidatePackages.id, input.packageId));
      });
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Could not extract enough text from the PDF. Please try a different file.",
      });
    }

    // 6. Parse with AI
    let parsed;
    try {
      parsed = await parseResume(resumeText);
    } catch (err) {
      await ctx.secureDb!.rls(async (tx) => {
        await tx
          .update(candidatePackages)
          .set({ parseStatus: "error" as const, updatedAt: new Date() })
          .where(eq(candidatePackages.id, input.packageId));
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `AI parsing failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 7. Insert parsed data into all child tables + update package
    await ctx.secureDb!.rls(async (tx) => {
      // Clear existing AI-generated data
      await tx
        .delete(packageExperiences)
        .where(eq(packageExperiences.packageId, input.packageId));
      await tx
        .delete(packageSkills)
        .where(eq(packageSkills.packageId, input.packageId));
      await tx
        .delete(packageEducation)
        .where(eq(packageEducation.packageId, input.packageId));
      await tx
        .delete(packageCertifications)
        .where(eq(packageCertifications.packageId, input.packageId));
      await tx
        .delete(packageRoleTargets)
        .where(eq(packageRoleTargets.packageId, input.packageId));

      // Insert experiences
      if (parsed.experiences.length > 0) {
        await tx.insert(packageExperiences).values(
          parsed.experiences.map((exp, i) => ({
            packageId: input.packageId,
            company: exp.company,
            roleTitle: exp.roleTitle,
            startDate: exp.startDate ?? null,
            endDate: exp.endDate ?? null,
            isCurrent: exp.isCurrent ?? false,
            description: exp.description ?? null,
            aiGenerated: true,
            sortOrder: i,
          })),
        );
      }

      // Insert skills
      if (parsed.skills.length > 0) {
        await tx.insert(packageSkills).values(
          parsed.skills.map((skill, i) => ({
            packageId: input.packageId,
            name: skill.name,
            category: skill.category ?? null,
            aiGenerated: true,
            sortOrder: i,
          })),
        );
      }

      // Insert education
      if (parsed.education.length > 0) {
        await tx.insert(packageEducation).values(
          parsed.education.map((edu, i) => ({
            packageId: input.packageId,
            institution: edu.institution,
            degree: edu.degree ?? null,
            fieldOfStudy: edu.fieldOfStudy ?? null,
            startDate: edu.startDate ?? null,
            endDate: edu.endDate ?? null,
            aiGenerated: true,
            sortOrder: i,
          })),
        );
      }

      // Insert certifications
      if (parsed.certifications.length > 0) {
        await tx.insert(packageCertifications).values(
          parsed.certifications.map((cert, i) => ({
            packageId: input.packageId,
            name: cert.name,
            issuer: cert.issuer ?? null,
            issueDate: cert.issueDate ?? null,
            expiryDate: cert.expiryDate ?? null,
            aiGenerated: true,
            sortOrder: i,
          })),
        );
      }

      // Insert role targets
      if (parsed.roleTargets.length > 0) {
        await tx.insert(packageRoleTargets).values(
          parsed.roleTargets.map((target, i) => ({
            packageId: input.packageId,
            roleTitle: target.roleTitle,
            aiGenerated: true,
            sortOrder: i,
          })),
        );
      }

      // Update package summary + recalculate completion
      await tx
        .update(candidatePackages)
        .set({
          aiRoleTitle: parsed.summary?.roleTitle ?? null,
          aiSummary: parsed.summary?.aiSummary ?? null,
          parseStatus: "parsed" as const,
          updatedAt: new Date(),
        })
        .where(eq(candidatePackages.id, input.packageId));

      await recalcCompletion(tx, input.packageId);
    });

    return { success: true };
  });

/**
 * Update experiences for a package (delete-and-reinsert).
 */
export const updateExperiences = authedProcedure
  .input(
    z.object({
      packageId: z.string().uuid(),
      experiences: z.array(
        z.object({
          company: z.string().min(1),
          roleTitle: z.string().min(1),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          isCurrent: z.boolean().optional().default(false),
          description: z.string().optional(),
          aiGenerated: z.boolean().optional().default(false),
        }),
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.secureDb!.rls(async (tx) => {
      // Verify ownership
      const [pkg] = await tx
        .select({ id: candidatePackages.id })
        .from(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      await tx
        .delete(packageExperiences)
        .where(eq(packageExperiences.packageId, input.packageId));

      if (input.experiences.length > 0) {
        await tx.insert(packageExperiences).values(
          input.experiences.map((exp, i) => ({
            packageId: input.packageId,
            company: exp.company,
            roleTitle: exp.roleTitle,
            startDate: exp.startDate ?? null,
            endDate: exp.endDate ?? null,
            isCurrent: exp.isCurrent,
            description: exp.description ?? null,
            aiGenerated: exp.aiGenerated,
            sortOrder: i,
          })),
        );
      }

      await recalcCompletion(tx, input.packageId);
    });

    return { success: true };
  });

/**
 * Update skills for a package (delete-and-reinsert).
 */
export const updateSkills = authedProcedure
  .input(
    z.object({
      packageId: z.string().uuid(),
      skills: z.array(
        z.object({
          name: z.string().min(1),
          category: z.string().optional(),
          aiGenerated: z.boolean().optional().default(false),
        }),
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.secureDb!.rls(async (tx) => {
      const [pkg] = await tx
        .select({ id: candidatePackages.id })
        .from(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      await tx
        .delete(packageSkills)
        .where(eq(packageSkills.packageId, input.packageId));

      if (input.skills.length > 0) {
        await tx.insert(packageSkills).values(
          input.skills.map((skill, i) => ({
            packageId: input.packageId,
            name: skill.name,
            category: skill.category ?? null,
            aiGenerated: skill.aiGenerated,
            sortOrder: i,
          })),
        );
      }

      await recalcCompletion(tx, input.packageId);
    });

    return { success: true };
  });

/**
 * Update education + certifications for a package.
 */
export const updateEducation = authedProcedure
  .input(
    z.object({
      packageId: z.string().uuid(),
      education: z.array(
        z.object({
          institution: z.string().min(1),
          degree: z.string().optional(),
          fieldOfStudy: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          aiGenerated: z.boolean().optional().default(false),
        }),
      ),
      certifications: z
        .array(
          z.object({
            name: z.string().min(1),
            issuer: z.string().optional(),
            issueDate: z.string().optional(),
            expiryDate: z.string().optional(),
            aiGenerated: z.boolean().optional().default(false),
          }),
        )
        .optional()
        .default([]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.secureDb!.rls(async (tx) => {
      const [pkg] = await tx
        .select({ id: candidatePackages.id })
        .from(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      // Education
      await tx
        .delete(packageEducation)
        .where(eq(packageEducation.packageId, input.packageId));

      if (input.education.length > 0) {
        await tx.insert(packageEducation).values(
          input.education.map((edu, i) => ({
            packageId: input.packageId,
            institution: edu.institution,
            degree: edu.degree ?? null,
            fieldOfStudy: edu.fieldOfStudy ?? null,
            startDate: edu.startDate ?? null,
            endDate: edu.endDate ?? null,
            aiGenerated: edu.aiGenerated,
            sortOrder: i,
          })),
        );
      }

      // Certifications
      await tx
        .delete(packageCertifications)
        .where(eq(packageCertifications.packageId, input.packageId));

      if (input.certifications.length > 0) {
        await tx.insert(packageCertifications).values(
          input.certifications.map((cert, i) => ({
            packageId: input.packageId,
            name: cert.name,
            issuer: cert.issuer ?? null,
            issueDate: cert.issueDate ?? null,
            expiryDate: cert.expiryDate ?? null,
            aiGenerated: cert.aiGenerated,
            sortOrder: i,
          })),
        );
      }

      await recalcCompletion(tx, input.packageId);
    });

    return { success: true };
  });

/**
 * Update preferences for a package (upsert — single row per package).
 */
export const updatePreferences = authedProcedure
  .input(
    z.object({
      packageId: z.string().uuid(),
      workStyles: z.array(z.string()).optional(),
      companySizes: z.array(z.string()).optional(),
      compRangeMin: z.number().int().nonnegative().optional(),
      compRangeMax: z.number().int().nonnegative().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.secureDb!.rls(async (tx) => {
      const [pkg] = await tx
        .select({ id: candidatePackages.id })
        .from(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      // Check if preferences already exist
      const [existing] = await tx
        .select({ id: packagePreferences.id })
        .from(packagePreferences)
        .where(eq(packagePreferences.packageId, input.packageId))
        .limit(1);

      if (existing) {
        await tx
          .update(packagePreferences)
          .set({
            workStyles: input.workStyles ?? null,
            companySizes: input.companySizes ?? null,
            compRangeMin: input.compRangeMin ?? null,
            compRangeMax: input.compRangeMax ?? null,
            updatedAt: new Date(),
          })
          .where(eq(packagePreferences.packageId, input.packageId));
      } else {
        await tx.insert(packagePreferences).values({
          packageId: input.packageId,
          workStyles: input.workStyles ?? null,
          companySizes: input.companySizes ?? null,
          compRangeMin: input.compRangeMin ?? null,
          compRangeMax: input.compRangeMax ?? null,
        });
      }

      await recalcCompletion(tx, input.packageId);
    });

    return { success: true };
  });

/**
 * Update role targets (delete-and-reinsert).
 */
export const updateTargets = authedProcedure
  .input(
    z.object({
      packageId: z.string().uuid(),
      targets: z.array(
        z.object({
          roleTitle: z.string().min(1),
          aiGenerated: z.boolean().optional().default(false),
        }),
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.secureDb!.rls(async (tx) => {
      const [pkg] = await tx
        .select({ id: candidatePackages.id })
        .from(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.packageId),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      await tx
        .delete(packageRoleTargets)
        .where(eq(packageRoleTargets.packageId, input.packageId));

      if (input.targets.length > 0) {
        await tx.insert(packageRoleTargets).values(
          input.targets.map((target, i) => ({
            packageId: input.packageId,
            roleTitle: target.roleTitle,
            aiGenerated: target.aiGenerated,
            sortOrder: i,
          })),
        );
      }

      await recalcCompletion(tx, input.packageId);
    });

    return { success: true };
  });

/**
 * Publish a draft package (set status to "complete").
 */
export const publish = authedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.secureDb!.rls(async (tx) => {
      return tx
        .update(candidatePackages)
        .set({
          status: "complete" as const,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(candidatePackages.id, input.id),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        )
        .returning();
    });

    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
    }

    return updated;
  });

/**
 * Delete a package (cascade-deletes all child rows).
 */
export const deletePackage = authedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.secureDb!.rls(async (tx) => {
      await tx
        .delete(candidatePackages)
        .where(
          and(
            eq(candidatePackages.id, input.id),
            eq(candidatePackages.userId, ctx.user.id),
          ),
        );
    });

    return { success: true };
  });

/* ── Router ──────────────────────────────────────────────────────────── */

export const packagesRouter = createTRPCRouter({
  list,
  getById,
  create,
  uploadAndParse,
  updateExperiences,
  updateSkills,
  updateEducation,
  updatePreferences,
  updateTargets,
  publish,
  delete: deletePackage,
});
