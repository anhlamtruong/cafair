/**
 * Package Management — Drizzle schema
 *
 * 7 tables that back the candidate-facing "Application Package" feature.
 * Follows the same pattern as socialScreenBatchJobs.ts:
 *   pgTable → typed columns → $inferSelect / $inferInsert exports → indexes.
 *
 * Tables:
 *  1. candidate_packages       — main package record
 *  2. package_experiences      — work-experience entries
 *  3. package_skills           — extracted / user-added skills
 *  4. package_education        — education entries
 *  5. package_certifications   — certification entries
 *  6. package_preferences      — work-style & compensation (1-to-1)
 *  7. package_role_targets     — targeted role titles
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "@starter/db/schema";

/* ────────────────────────────────────────────────────────────────────────
   1. candidate_packages
   ──────────────────────────────────────────────────────────────────────── */

export type PackageStatus = "draft" | "complete";
export type ParseStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "parsed"
  | "error";

export const candidatePackages = pgTable(
  "candidate_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    status: text("status")
      .$type<PackageStatus>()
      .notNull()
      .default("draft"),

    parseStatus: text("parse_status")
      .$type<ParseStatus>()
      .notNull()
      .default("idle"),

    resumeUrl: text("resume_url"),
    resumeFileName: text("resume_file_name"),

    completionPercentage: integer("completion_percentage")
      .notNull()
      .default(0),

    aiRoleTitle: text("ai_role_title"),
    aiSummary: text("ai_summary"),

    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("candidate_packages_user_id_idx").on(table.userId),
    index("candidate_packages_status_idx").on(table.status),
    index("candidate_packages_user_status_idx").on(
      table.userId,
      table.status,
    ),
  ],
);

export type CandidatePackageRow = typeof candidatePackages.$inferSelect;
export type NewCandidatePackageRow = typeof candidatePackages.$inferInsert;

/* ────────────────────────────────────────────────────────────────────────
   2. package_experiences
   ──────────────────────────────────────────────────────────────────────── */

export const packageExperiences = pgTable(
  "package_experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    packageId: uuid("package_id")
      .notNull()
      .references(() => candidatePackages.id, { onDelete: "cascade" }),

    company: text("company").notNull(),
    roleTitle: text("role_title").notNull(),
    startDate: text("start_date"), // YYYY-MM
    endDate: text("end_date"), // null = current
    isCurrent: boolean("is_current").notNull().default(false),
    description: text("description"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("package_experiences_package_id_idx").on(table.packageId),
  ],
);

export type PackageExperienceRow = typeof packageExperiences.$inferSelect;
export type NewPackageExperienceRow = typeof packageExperiences.$inferInsert;

/* ────────────────────────────────────────────────────────────────────────
   3. package_skills
   ──────────────────────────────────────────────────────────────────────── */

export const packageSkills = pgTable(
  "package_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    packageId: uuid("package_id")
      .notNull()
      .references(() => candidatePackages.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    category: text("category"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("package_skills_package_id_idx").on(table.packageId),
  ],
);

export type PackageSkillRow = typeof packageSkills.$inferSelect;
export type NewPackageSkillRow = typeof packageSkills.$inferInsert;

/* ────────────────────────────────────────────────────────────────────────
   4. package_education
   ──────────────────────────────────────────────────────────────────────── */

export const packageEducation = pgTable(
  "package_education",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    packageId: uuid("package_id")
      .notNull()
      .references(() => candidatePackages.id, { onDelete: "cascade" }),

    institution: text("institution").notNull(),
    degree: text("degree"),
    fieldOfStudy: text("field_of_study"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("package_education_package_id_idx").on(table.packageId),
  ],
);

export type PackageEducationRow = typeof packageEducation.$inferSelect;
export type NewPackageEducationRow = typeof packageEducation.$inferInsert;

/* ────────────────────────────────────────────────────────────────────────
   5. package_certifications
   ──────────────────────────────────────────────────────────────────────── */

export const packageCertifications = pgTable(
  "package_certifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    packageId: uuid("package_id")
      .notNull()
      .references(() => candidatePackages.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    issuer: text("issuer"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("package_certifications_package_id_idx").on(table.packageId),
  ],
);

export type PackageCertificationRow =
  typeof packageCertifications.$inferSelect;
export type NewPackageCertificationRow =
  typeof packageCertifications.$inferInsert;

/* ────────────────────────────────────────────────────────────────────────
   6. package_preferences  (1-to-1 with candidate_packages)
   ──────────────────────────────────────────────────────────────────────── */

export const packagePreferences = pgTable(
  "package_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    packageId: uuid("package_id")
      .notNull()
      .references(() => candidatePackages.id, { onDelete: "cascade" }),

    workStyles: jsonb("work_styles").$type<string[]>(),
    companySizes: jsonb("company_sizes").$type<string[]>(),

    compRangeMin: integer("comp_range_min"),
    compRangeMax: integer("comp_range_max"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("package_preferences_package_id_unique").on(table.packageId),
  ],
);

export type PackagePreferencesRow = typeof packagePreferences.$inferSelect;
export type NewPackagePreferencesRow = typeof packagePreferences.$inferInsert;

/* ────────────────────────────────────────────────────────────────────────
   7. package_role_targets
   ──────────────────────────────────────────────────────────────────────── */

export const packageRoleTargets = pgTable(
  "package_role_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    packageId: uuid("package_id")
      .notNull()
      .references(() => candidatePackages.id, { onDelete: "cascade" }),

    roleTitle: text("role_title").notNull(),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("package_role_targets_package_id_idx").on(table.packageId),
  ],
);

export type PackageRoleTargetRow = typeof packageRoleTargets.$inferSelect;
export type NewPackageRoleTargetRow = typeof packageRoleTargets.$inferInsert;
