"use client";

/**
 * Package Empty State — illustration + CTA when no package exists.
 *
 * Pure CSS illustration: resume card → arrow → 3 stacked ID cards
 * No external images required.
 *
 * Matches Figma node 2155:1192 body section.
 */

import {
  ArrowRight,
  Plus,
  Loader2,
} from "lucide-react"; /* TODO:icons — replace with Figma SVGs */

interface PackageEmptyStateProps {
  onCreate?: () => void;
  isCreating?: boolean;
}

export function PackageEmptyState({
  onCreate,
  isCreating,
}: PackageEmptyStateProps) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-12 rounded-2xl bg-bg-primary px-4 py-5">
      {/* ── CSS-only illustration ──────────────────────────────── */}
      <div className="flex items-center gap-10">
        {/* Resume card */}
        <ResumeCard />

        {/* Arrow */}
        <div className="flex size-12 items-center justify-center rounded-full border border-border-neutral bg-neutral-0">
          {/* TODO:icons — replace with Figma arrow SVG */}
          <ArrowRight className="size-5 text-text-brand" />
        </div>

        {/* Stacked ID cards */}
        <IDCardStack />
      </div>

      {/* ── Text + CTA ────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold leading-8 text-neutral-900">
            No package created yet
          </h2>
          <p className="max-w-[380px] text-base font-normal leading-6 text-text-secondary">
            Create your application package to start matching with roles and
            applying to positions.
          </p>
        </div>

        {/* CTA button */}
        <button
          type="button"
          onClick={onCreate}
          disabled={isCreating}
          className="flex items-center gap-2 rounded-[14px] px-6 py-3 text-base font-semibold leading-6 text-neutral-0 transition-opacity disabled:opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(171deg, var(--brand-900) 16%, #156139 72%)",
          }}
        >
          {isCreating ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Plus className="size-5" />
          )}
          {isCreating ? "Creating…" : "Create Application Package"}
        </button>

        <p className="text-sm font-normal leading-5 text-text-tertiary">
          It only takes a few minutes to get started
        </p>
      </div>
    </div>
  );
}

/* ── Resume Card (CSS-only) ───────────────────────────────────────────── */

function ResumeCard() {
  return (
    <div
      className="relative flex flex-col items-start gap-2 rounded-xl p-4 shadow-lg"
      style={{
        width: 96 /* TODO: Hard code value */,
        height: 80 /* TODO: Hard code value */,
        /* TODO-hard code color — gentle brand gradient */
        backgroundImage:
          "linear-gradient(160deg, var(--brand-100) 0%, var(--neutral-0) 100%)",
      }}
    >
      {/* Fake text lines */}
      <div className="h-2 w-12 rounded-full bg-brand-500 opacity-60" />
      <div className="h-1.5 w-16 rounded-full bg-neutral-200" />
      <div className="h-1.5 w-14 rounded-full bg-neutral-200" />
      <div className="h-1.5 w-10 rounded-full bg-neutral-200" />
    </div>
  );
}

/* ── ID Card Stack (CSS-only) ─────────────────────────────────────────── */

function IDCardStack() {
  return (
    <div
      className="relative"
      style={{ width: 112, height: 100 }} /* TODO: Hard code value */
    >
      {/* Back card (rotated) */}
      <div
        className="absolute rounded-xl bg-neutral-0 shadow-md"
        style={{
          width: 112,
          height: 80,
          top: 20,
          left: 0,
          transform: "rotate(6deg)" /* TODO: Hard code value */,
        }}
      >
        <IDCardContent opacity={0.4} />
      </div>

      {/* Middle card */}
      <div
        className="absolute rounded-xl bg-neutral-0 shadow-lg"
        style={{
          width: 112,
          height: 80,
          top: 10,
          left: 0,
          transform: "rotate(3deg)" /* TODO: Hard code value */,
        }}
      >
        <IDCardContent opacity={0.6} />
      </div>

      {/* Front card */}
      <div
        className="absolute rounded-xl bg-neutral-0 shadow-xl"
        style={{
          width: 112,
          height: 80,
          top: 0,
          left: 0,
        }}
      >
        <IDCardContent opacity={1} />
      </div>
    </div>
  );
}

/** Inner content of an ID card placeholder */
function IDCardContent({ opacity }: { opacity: number }) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-1.5 px-3"
      style={{ opacity }}
    >
      {/* Avatar placeholder */}
      <div className="size-5 rounded-full bg-brand-500 opacity-50" />
      {/* Text lines */}
      <div className="h-1.5 w-14 rounded-full bg-neutral-400" />
      <div className="h-1.5 w-10 rounded-full bg-neutral-200" />
    </div>
  );
}
