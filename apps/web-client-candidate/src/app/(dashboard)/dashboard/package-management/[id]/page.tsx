"use client";

/**
 * Package Build Page — /dashboard/package-management/[id]
 *
 * Full CRUD editor for a single candidate package:
 *   - Resume upload + AI parsing
 *   - 5 section tabs (Experience, Skills, Education, Preferences, Targets)
 *   - Save / Publish
 *   - Profile summary sidebar
 */

import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeSlideUp, staggerContainerMedium } from "@/lib/motion";

import { usePackageFormStore } from "@/services/packages/store/package-form-store";

import {
  BuildPacketHeader,
  SectionTabs,
  ResumeDropzone,
  ParsingAnimation,
  ExperienceSection,
  SkillsSection,
  EducationSection,
  PreferencesSection,
  TargetsSection,
  ProfileSummaryCard,
  SavePublishButton,
  type SectionTabKey,
  type ExperienceItem,
  type SkillItem,
  type EducationItem,
  type CertificationItem,
  type PreferencesData,
  type TargetItem,
} from "@/components/dashboard/package/build";

import { Skeleton } from "@starter/ui";

export default function PackageBuildPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const packageId = params.id;

  /* ── Zustand store ──────────────────────────────────── */
  const { activeTab, isDirty, setActiveTab, markDirty, markClean, reset } =
    usePackageFormStore();

  /* ── Query ──────────────────────────────────────────── */
  const {
    data: pkg,
    isLoading,
    refetch,
  } = useQuery(trpc.packages.getById.queryOptions({ id: packageId }));

  /* ── Local form state (derived from server data) ───── */
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [preferences, setPreferences] = useState<PreferencesData>({
    workStyles: [],
    companySizes: [],
    compRangeMin: "",
    compRangeMax: "",
  });
  const [targets, setTargets] = useState<TargetItem[]>([]);

  // Hydrate local state from server data
  useEffect(() => {
    if (!pkg) return;

    setExperiences(
      pkg.experiences.map((e) => ({
        company: e.company,
        roleTitle: e.roleTitle,
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        isCurrent: e.isCurrent ?? false,
        description: e.description ?? "",
        aiGenerated: e.aiGenerated ?? false,
      })),
    );

    setSkills(
      pkg.skills.map((s) => ({
        name: s.name,
        category: s.category ?? "",
        aiGenerated: s.aiGenerated ?? false,
      })),
    );

    setEducation(
      pkg.education.map((e) => ({
        institution: e.institution,
        degree: e.degree ?? "",
        fieldOfStudy: e.fieldOfStudy ?? "",
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        aiGenerated: e.aiGenerated ?? false,
      })),
    );

    setCertifications(
      pkg.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer ?? "",
        issueDate: c.issueDate ?? "",
        expiryDate: c.expiryDate ?? "",
        aiGenerated: c.aiGenerated ?? false,
      })),
    );

    setPreferences({
      workStyles: (pkg.preferences?.workStyles as string[]) ?? [],
      companySizes: (pkg.preferences?.companySizes as string[]) ?? [],
      compRangeMin: pkg.preferences?.compRangeMin?.toString() ?? "",
      compRangeMax: pkg.preferences?.compRangeMax?.toString() ?? "",
    });

    setTargets(
      pkg.roleTargets.map((t) => ({
        roleTitle: t.roleTitle,
        aiGenerated: t.aiGenerated ?? false,
      })),
    );

    markClean();
  }, [pkg, markClean]);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  /* ── Mutations ──────────────────────────────────────── */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.packages.getById.queryKey({ id: packageId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.packages.list.queryKey(),
    });
  }, [queryClient, trpc, packageId]);

  const uploadMutation = useMutation(
    trpc.packages.uploadAndParse.mutationOptions({
      onSuccess: () => {
        invalidate();
        refetch();
      },
    }),
  );

  const updateExpMutation = useMutation(
    trpc.packages.updateExperiences.mutationOptions({
      onSuccess: () => {
        invalidate();
        markClean();
      },
    }),
  );

  const updateSkillsMutation = useMutation(
    trpc.packages.updateSkills.mutationOptions({
      onSuccess: () => {
        invalidate();
        markClean();
      },
    }),
  );

  const updateEduMutation = useMutation(
    trpc.packages.updateEducation.mutationOptions({
      onSuccess: () => {
        invalidate();
        markClean();
      },
    }),
  );

  const updatePrefMutation = useMutation(
    trpc.packages.updatePreferences.mutationOptions({
      onSuccess: () => {
        invalidate();
        markClean();
      },
    }),
  );

  const updateTargetsMutation = useMutation(
    trpc.packages.updateTargets.mutationOptions({
      onSuccess: () => {
        invalidate();
        markClean();
      },
    }),
  );

  const publishMutation = useMutation(
    trpc.packages.publish.mutationOptions({
      onSuccess: () => {
        invalidate();
        router.push("/dashboard/package-management");
      },
    }),
  );

  /* ── File upload handler ────────────────────────────── */
  const handleFileSelect = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        if (base64) {
          uploadMutation.mutate({
            packageId,
            base64,
            fileName: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
    },
    [uploadMutation, packageId],
  );

  /* ── Save current tab ──────────────────────────────── */
  const isSaving =
    updateExpMutation.isPending ||
    updateSkillsMutation.isPending ||
    updateEduMutation.isPending ||
    updatePrefMutation.isPending ||
    updateTargetsMutation.isPending;

  const handleSave = useCallback(() => {
    switch (activeTab) {
      case "experience":
        updateExpMutation.mutate({ packageId, experiences });
        break;
      case "skills":
        updateSkillsMutation.mutate({ packageId, skills });
        break;
      case "education":
        updateEduMutation.mutate({
          packageId,
          education,
          certifications,
        });
        break;
      case "preferences":
        updatePrefMutation.mutate({
          packageId,
          workStyles: preferences.workStyles,
          companySizes: preferences.companySizes,
          compRangeMin: preferences.compRangeMin
            ? parseInt(preferences.compRangeMin, 10)
            : undefined,
          compRangeMax: preferences.compRangeMax
            ? parseInt(preferences.compRangeMax, 10)
            : undefined,
        });
        break;
      case "targets":
        updateTargetsMutation.mutate({ packageId, targets });
        break;
    }
  }, [
    activeTab,
    packageId,
    experiences,
    skills,
    education,
    certifications,
    preferences,
    targets,
    updateExpMutation,
    updateSkillsMutation,
    updateEduMutation,
    updatePrefMutation,
    updateTargetsMutation,
  ]);

  const handlePublish = useCallback(() => {
    // Save current tab first, then publish
    handleSave();
    publishMutation.mutate({ id: packageId });
  }, [handleSave, publishMutation, packageId]);

  /* ── Section completeness ──────────────────────────── */
  const completedSections = useMemo(
    () => ({
      experience: experiences.length > 0,
      skills: skills.length > 0,
      education: education.length > 0,
      preferences:
        preferences.workStyles.length > 0 ||
        preferences.companySizes.length > 0,
      targets: targets.length > 0,
    }),
    [experiences, skills, education, preferences, targets],
  );

  /* ── Wrap onChange to mark dirty ────────────────────── */
  const setExperiencesDirty = useCallback(
    (items: ExperienceItem[]) => {
      setExperiences(items);
      markDirty();
    },
    [markDirty],
  );
  const setSkillsDirty = useCallback(
    (items: SkillItem[]) => {
      setSkills(items);
      markDirty();
    },
    [markDirty],
  );
  const setEducationDirty = useCallback(
    (items: EducationItem[]) => {
      setEducation(items);
      markDirty();
    },
    [markDirty],
  );
  const setCertificationsDirty = useCallback(
    (items: CertificationItem[]) => {
      setCertifications(items);
      markDirty();
    },
    [markDirty],
  );
  const setPreferencesDirty = useCallback(
    (data: PreferencesData) => {
      setPreferences(data);
      markDirty();
    },
    [markDirty],
  );
  const setTargetsDirty = useCallback(
    (items: TargetItem[]) => {
      setTargets(items);
      markDirty();
    },
    [markDirty],
  );

  /* ── Loading state ──────────────────────────────────── */
  if (isLoading || !pkg) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-12 rounded-[14px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 rounded-[14px]" />
          <Skeleton className="h-48 rounded-[14px]" />
        </div>
      </div>
    );
  }

  const isParsing =
    pkg.parseStatus === "uploading" ||
    pkg.parseStatus === "parsing" ||
    uploadMutation.isPending;

  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={staggerContainerMedium}
      initial="hidden"
      animate="show"
    >
      {/* Header with back + progress */}
      <motion.div variants={fadeSlideUp}>
        <BuildPacketHeader
          title={pkg.title}
          completionPercentage={pkg.completionPercentage}
        />
      </motion.div>

      {/* Resume drop zone + parsing */}
      <motion.div variants={fadeSlideUp}>
        <div className="rounded-2xl bg-bg-primary px-4 py-5">
          <AnimatePresence mode="wait">
            {isParsing ? (
              <ParsingAnimation status={pkg.parseStatus} />
            ) : (
              <ResumeDropzone
                onFileSelect={handleFileSelect}
                isUploading={uploadMutation.isPending}
                existingFileName={pkg.resumeFileName}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Section tabs */}
      <motion.div variants={fadeSlideUp}>
        <div className="rounded-2xl bg-bg-primary px-4 py-3">
          <SectionTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            completedSections={completedSections}
          />
        </div>
      </motion.div>

      {/* Main content: editor + sidebar */}
      <motion.div variants={fadeSlideUp}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Editor panel */}
          <div className="flex flex-col gap-4 rounded-2xl bg-bg-primary px-4 py-5">
            <AnimatePresence mode="wait">
              {activeTab === "experience" && (
                <motion.div
                  key="experience"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <ExperienceSection
                    items={experiences}
                    onChange={setExperiencesDirty}
                  />
                </motion.div>
              )}

              {activeTab === "skills" && (
                <motion.div
                  key="skills"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <SkillsSection items={skills} onChange={setSkillsDirty} />
                </motion.div>
              )}

              {activeTab === "education" && (
                <motion.div
                  key="education"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <EducationSection
                    education={education}
                    certifications={certifications}
                    onEducationChange={setEducationDirty}
                    onCertificationsChange={setCertificationsDirty}
                  />
                </motion.div>
              )}

              {activeTab === "preferences" && (
                <motion.div
                  key="preferences"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <PreferencesSection
                    data={preferences}
                    onChange={setPreferencesDirty}
                  />
                </motion.div>
              )}

              {activeTab === "targets" && (
                <motion.div
                  key="targets"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <TargetsSection items={targets} onChange={setTargetsDirty} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save / Publish buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border-neutral pt-4">
              <SavePublishButton
                mode="save"
                isPending={isSaving}
                isDirty={isDirty}
                onClick={handleSave}
              />
              <SavePublishButton
                mode="publish"
                isPending={publishMutation.isPending}
                isDirty={true}
                onClick={handlePublish}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <ProfileSummaryCard
              roleTitle={pkg.aiRoleTitle}
              summary={pkg.aiSummary}
              completionPercentage={pkg.completionPercentage}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
