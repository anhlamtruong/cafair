"use client";

/**
 * Application Pipeline — Pipeline overview + Quick Stats
 *
 * Left:  Concentric circles showing pipeline funnel (Applied → Reviewing → Interview → Offer)
 * Right: 4 stat cards stacked vertically
 *
 * Matches Figma node 2172:1300.
 */

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  FileText,
  Calendar,
  XCircle,
  ChevronDown,
} from "lucide-react"; /* TODO:icons — replace with exact Figma SVGs */
import type { LucideIcon } from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface QuickStat {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Highlight the first card with brand-100 bg */
  highlight?: boolean;
}

/* ── Mock data ────────────────────────────────────────────────────────── */

const PIPELINE_DATA = {
  applied: 0 /* TODO: Hard code value */,
  reviewing: 0 /* TODO: Hard code value */,
  interview: 0 /* TODO: Hard code value */,
  offer: 0 /* TODO: Hard code value */,
};

const QUICK_STATS: QuickStat[] = [
  {
    label: "Applications active",
    value: 0 /* TODO: Hard code value */,
    icon: TrendingUp,
    highlight: true,
  },
  {
    label: "Reviewing",
    value: 0 /* TODO: Hard code value */,
    icon: FileText,
  },
  {
    label: "Interview requests",
    value: 0 /* TODO: Hard code value */,
    icon: Calendar,
  },
  {
    label: "Rejected",
    value: 0 /* TODO: Hard code value */,
    icon: XCircle,
  },
];

/* ── Main Container ───────────────────────────────────────────────────── */

export function ApplicationPipeline() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Section header ──────────────────────────────────────── */}
      <PipelineHeader />

      {/* ── Body: circles + stats ───────────────────────────────── */}
      <div className="flex gap-8">
        <PipelineOverview />
        <QuickStatsPanel />
      </div>
    </div>
  );
}

/* ── Pipeline Header ──────────────────────────────────────────────────── */

function PipelineHeader() {
  return (
    <div className="flex items-start gap-8">
      <div className="flex flex-1 flex-col gap-2">
        <h2 className="text-4xl font-semibold leading-10 text-neutral-900">
          Application Pipeline
        </h2>
        <p className="text-base font-normal leading-6 text-text-secondary">
          Track your job applications and manage your pipeline
        </p>
      </div>

      {/* Time range dropdown */}
      <button
        type="button"
        className="flex shrink-0 items-center gap-2 overflow-clip rounded-[10px] bg-neutral-0 px-4 py-3"
      >
        <span className="text-lg font-bold leading-7 tracking-[-0.45px] text-neutral-900">
          3 months {/* TODO: Hard code value */}
        </span>
        {/* TODO:icons — replace with Figma chevron-down SVG */}
        <ChevronDown className="size-[18px] text-neutral-900" />
      </button>
    </div>
  );
}

/* ── Pipeline Overview (concentric circles) ──────────────────────────── */

function PipelineOverview() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 rounded-2xl bg-neutral-0 px-8 pt-8">
      <h3 className="text-2xl font-semibold leading-8 text-neutral-900">
        Pipeline Overview
      </h3>

      {/* Circle container — fixed 384px, centered */}
      <div
        className="relative mx-auto"
        style={{ width: 384, height: 384 }} /* TODO: Hard code value */
      >
        {/* Outer: Applied — 384px */}
        <div className="absolute inset-0 rounded-full bg-bg-primary">
          <CircleLabel
            value={PIPELINE_DATA.applied}
            label="Applied"
            className="left-1/2 top-[22.5px] -translate-x-1/2"
          />
        </div>

        {/* 2nd: Reviewing — 288px */}
        <div
          className="absolute rounded-full bg-bg-brand"
          style={{
            width: 288,
            height: 288,
            top: 96,
            left: 48,
          }} /* TODO: Hard code value */
        >
          <CircleLabel
            value={PIPELINE_DATA.reviewing}
            label="Reviewing"
            className="left-1/2 top-[24.5px] -translate-x-1/2"
          />
        </div>

        {/* 3rd: Interview — 192px */}
        <div
          className="absolute rounded-full bg-brand-300"
          style={{
            width: 192,
            height: 192,
            top: 192,
            left: 96,
          }} /* TODO: Hard code value */
        >
          <CircleLabel
            value={PIPELINE_DATA.interview}
            label="Interview"
            className="left-1/2 top-[24.5px] -translate-x-1/2"
          />
        </div>

        {/* Inner: Offer — 96px */}
        <div
          className="absolute flex items-center justify-center rounded-full bg-text-brand-2"
          style={{
            width: 96,
            height: 96,
            top: 288,
            left: 144,
          }} /* TODO: Hard code value */
        >
          <div className="flex flex-col items-center text-center text-neutral-0">
            <span className="text-2xl font-bold leading-[30px] tracking-[0.41px]">
              {PIPELINE_DATA.offer}
            </span>
            <span className="text-sm font-normal leading-4">Offer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared label for outer 3 pipeline circles */
function CircleLabel({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex flex-col items-center whitespace-nowrap text-text-brand",
        className,
      )}
    >
      <span className="text-2xl font-bold leading-[30px] tracking-[0.41px]">
        {value}
      </span>
      <span className="text-center text-sm font-normal leading-5">{label}</span>
    </div>
  );
}

/* ── Quick Stats Panel ────────────────────────────────────────────────── */

function QuickStatsPanel() {
  return (
    <div className="flex flex-1 flex-col gap-6 self-stretch">
      <h3 className="text-2xl font-semibold leading-8 text-neutral-900">
        Quick Stats
      </h3>

      <div className="flex flex-1 flex-col justify-between">
        {QUICK_STATS.map((stat) => (
          <QuickStatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </div>
  );
}

function QuickStatCard({ stat }: { stat: QuickStat }) {
  const Icon = stat.icon;

  return (
    <div
      className={cn(
        "flex h-[108px] flex-col rounded-2xl px-[26px] pb-0.5 pt-[26px]",
        /* TODO: Hard code value — 108px height */
        stat.highlight ? "bg-brand-100" : "bg-neutral-0",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Icon circle */}
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-text-brand">
          {/* TODO:icons — replace with Figma SVGs */}
          <Icon className="size-6 text-neutral-0" />
        </div>

        {/* Label + value */}
        <div className="flex flex-col">
          <span className="text-base font-normal leading-5 text-neutral-900">
            {stat.label}
          </span>
          <span className="text-[30px] font-bold leading-9 text-neutral-900">
            {stat.value}
          </span>
        </div>
      </div>
    </div>
  );
}
