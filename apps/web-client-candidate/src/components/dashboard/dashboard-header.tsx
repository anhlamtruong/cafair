"use client";

/**
 * Dashboard Header — top bar inside the content area.
 *
 * Row 1: Logo + "AI Hire" brand name | User avatar + name + subtitle
 * Row 2 (optional via `showInsightBar`): Insight prompt + Send button | Date + "Show my Tasks" CTA + Calendar
 *
 * Matches Figma node 2172:1217.
 */

import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { fadeSlideUp, staggerContainer } from "@/lib/motion";
import {
  Send,
  ArrowRight,
  CalendarDays,
} from "lucide-react"; /* TODO:icons — replace with exact Figma SVGs */

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDateParts() {
  const now = new Date();
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "long" });
  return { day, weekday, month };
}

/* ── Component ────────────────────────────────────────────────────────── */

interface DashboardHeaderProps {
  /** Show the insight prompt + date + CTA row */
  showInsightBar?: boolean;
}

export function DashboardHeader({
  showInsightBar = false,
}: DashboardHeaderProps) {
  const { user } = useUser();
  const { day, weekday, month } = formatDateParts();

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-9 rounded-2xl bg-bg-primary p-6"
    >
      {/* ── Row 1: Brand + User ───────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        className="flex items-center justify-between"
      >
        {/* Left: Logo + brand name */}
        <div className="flex items-center gap-1">
          <div className="relative size-12 shrink-0">
            <Image
              src="/assets/navigation/logo.svg"
              alt="AI Hire logo"
              fill
              className="object-cover"
              sizes="48px"
              priority
            />
          </div>
          <span className="text-[30px] font-semibold leading-9 text-neutral-900">
            AI Hire
          </span>
        </div>

        {/* Right: User info */}
        <div className="flex items-center gap-2">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          )}
          <div className="flex flex-col gap-1 whitespace-nowrap font-[family-name:var(--font-inter)] leading-4">
            <span className="text-sm font-semibold text-neutral-900">
              {user?.fullName ?? "User"} {/* TODO: Hard code value */}
            </span>
            <span className="text-xs font-normal text-text-tertiary">
              Student {/* TODO: Hard code value */}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Row 2: Insight bar (conditional) ──────────────────────── */}
      {showInsightBar && (
        <motion.div
          variants={fadeSlideUp}
          className="flex items-start justify-between"
        >
          {/* Left: prompt + send button */}
          <div className="flex items-center gap-[60px] overflow-clip rounded-2xl">
            {/* Text */}
            <div className="flex w-[365px] flex-col gap-1">
              <p className="text-2xl font-medium leading-8 tracking-[0.07px] text-text-brand">
                Need help with insights?
              </p>
              <p className="text-lg leading-5 tracking-[-0.15px] text-text-secondary">
                <span className="animate-pulse text-text-secondary">|</span>
                Ask for insights, actions, or updates across your open roles.
              </p>
            </div>

            {/* Send button — circle 60×60 */}
            <button
              type="button"
              aria-label="Send insight prompt"
              className="flex size-[60px] shrink-0 items-center justify-center rounded-full border border-text-brand bg-bg-primary transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              {/* TODO:icons — replace with Figma paper-plane SVG */}
              <Send className="size-5 text-text-brand transition-transform duration-200 hover:rotate-12" />
            </button>
          </div>

          {/* Right: Date + CTA + Calendar */}
          <div className="flex h-[67px] items-center gap-20">
            {/* Date section */}
            <div className="flex items-center gap-4 border-r border-border-neutral pr-[33px]">
              {/* Date circle */}
              <div className="flex size-[60px] items-center justify-center rounded-full border border-border-neutral animate-[softPulse_3s_ease-in-out_infinite]">
                <span className="text-[28px] font-medium leading-10 tracking-[0.37px] text-neutral-900">
                  {day} {/* TODO: Hard code value */}
                </span>
              </div>
              {/* Weekday + Month */}
              <div className="flex flex-col text-sm font-medium leading-[21px] tracking-[-0.15px] text-neutral-900">
                <span>{weekday},</span>
                <span>{month}</span>
              </div>
            </div>

            {/* CTA section */}
            <div className="flex items-center gap-3">
              {/* "Show my Tasks" gradient button */}
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-[14px] px-4 py-3",
                  "text-sm font-normal leading-5 tracking-[-0.15px] text-neutral-0",
                  "transition-all duration-200 hover:brightness-110 hover:shadow-lg active:scale-[0.97]",
                )}
                style={{
                  /* TODO-hard code color — gradient from brand-900 to #156139 */
                  backgroundImage:
                    "linear-gradient(171deg, var(--brand-900) 16%, #156139 72%)",
                }}
              >
                Show my Tasks
                {/* TODO:icons — replace with Figma arrow SVG */}
                <ArrowRight className="size-[14px] transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              {/* Calendar icon button */}
              <button
                type="button"
                aria-label="Calendar"
                className="flex size-10 items-center justify-center rounded-[10px] border border-border-neutral transition-colors duration-200 hover:bg-neutral-200/50 active:scale-95"
              >
                {/* TODO:icons — replace with Figma calendar SVG */}
                <CalendarDays className="size-5 text-neutral-900" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
