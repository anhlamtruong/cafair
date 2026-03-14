"use client";

/**
 * PackageCard — Card for a single candidate package shown in the list view.
 *
 * Figma: bg-neutral-0 rounded-[14px] p-4,
 *   title 20px SemiBold, progress bar h-2,
 *   section badges, action buttons h-9/h-[38px] rounded-[10px]
 */

import { cn } from "@/lib/utils";
import { Progress } from "@starter/ui";
import { StatusBadge } from "./status-badge";
import { SectionBadge } from "./section-badge";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface PackageCardProps {
  pkg: {
    id: string;
    title: string;
    status: string | null;
    completionPercentage: number;
    aiRoleTitle: string | null;
    updatedAt: Date;
    sections: {
      experience: boolean;
      skills: boolean;
      education: boolean;
      preferences: boolean;
      targets: boolean;
    };
  };
  onDelete?: (id: string) => void;
}

const SECTION_LABELS: { key: keyof PackageCardProps["pkg"]["sections"]; label: string }[] = [
  { key: "experience", label: "Experience" },
  { key: "skills", label: "Skills" },
  { key: "education", label: "Education" },
  { key: "preferences", label: "Preferences" },
  { key: "targets", label: "Targets" },
];

export function PackageCard({ pkg, onDelete }: PackageCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] bg-neutral-0 p-4 shadow-sm">
      {/* Top row: title + status */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-[20px] font-semibold leading-7 text-neutral-900">
            {pkg.title}
          </h3>
          {pkg.aiRoleTitle && (
            <p className="text-sm text-text-secondary">{pkg.aiRoleTitle}</p>
          )}
        </div>
        <StatusBadge status={pkg.status ?? "draft"} />
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            Completion
          </span>
          <span className="text-xs font-semibold text-text-brand">
            {pkg.completionPercentage}%
          </span>
        </div>
        <Progress value={pkg.completionPercentage} />
      </div>

      {/* Section badges */}
      <div className="flex flex-wrap gap-2">
        {SECTION_LABELS.map((section) => (
          <SectionBadge
            key={section.key}
            label={section.label}
            complete={pkg.sections[section.key]}
          />
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 border-t border-border-neutral pt-3">
        <Link
          href={`/dashboard/package-management/${pkg.id}`}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold text-neutral-0",
          )}
          style={{
            backgroundImage:
              "linear-gradient(171deg, var(--brand-900) 16%, #156139 72%)",
          }}
        >
          <Pencil className="size-3.5" />
          {pkg.status === "complete" ? "Edit" : "Continue Building"}
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(pkg.id)}
            className="flex size-9 items-center justify-center rounded-[10px] border border-border-neutral bg-neutral-0 text-text-secondary transition-colors hover:border-red-300 hover:text-red-600"
            aria-label="Delete package"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
