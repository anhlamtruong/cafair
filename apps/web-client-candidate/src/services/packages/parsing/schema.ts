/**
 * Resume Parsing — Zod schemas & types for AI-extracted resume data.
 *
 * Shared between the parser, the tRPC router, and frontend form hydration.
 */

import { z } from "zod";

/* ── Parsed sub-section schemas ──────────────────────────────────────── */

export const parsedExperienceSchema = z.object({
  company: z.string().min(1),
  roleTitle: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().optional(),
});

export const parsedSkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
});

export const parsedEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const parsedCertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const parsedRoleTargetSchema = z.object({
  roleTitle: z.string().min(1),
});

/* ── Full parsed resume schema ───────────────────────────────────────── */

export const parsedResumeSchema = z.object({
  summary: z
    .object({
      roleTitle: z.string().optional(),
      aiSummary: z.string().optional(),
    })
    .optional(),
  experiences: z.array(parsedExperienceSchema).optional().default([]),
  skills: z.array(parsedSkillSchema).optional().default([]),
  education: z.array(parsedEducationSchema).optional().default([]),
  certifications: z.array(parsedCertificationSchema).optional().default([]),
  roleTargets: z.array(parsedRoleTargetSchema).optional().default([]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type ParsedExperience = z.infer<typeof parsedExperienceSchema>;
export type ParsedSkill = z.infer<typeof parsedSkillSchema>;
export type ParsedEducation = z.infer<typeof parsedEducationSchema>;
export type ParsedCertification = z.infer<typeof parsedCertificationSchema>;
export type ParsedRoleTarget = z.infer<typeof parsedRoleTargetSchema>;
