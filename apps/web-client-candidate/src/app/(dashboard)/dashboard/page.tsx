"use client";

/**
 * Dashboard page — Figma node 2172:1215
 *
 * Composed of three bento sections stacked vertically:
 *   1. DashboardHeader  (with insight bar)
 *   2. StatTileGrid     (4 summary tiles wrapped in a bento card)
 *   3. ApplicationPipeline (pipeline circles + quick stats in a bento card)
 *
 * Page-level stagger orchestration via framer-motion.
 */

import { motion } from "framer-motion";
import { fadeSlideUp, staggerContainerMedium } from "@/lib/motion";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatTileGrid } from "@/components/dashboard/stat-tile-grid";
import { ApplicationPipeline } from "@/components/dashboard/application-pipeline";

export default function DashboardPage() {
  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={staggerContainerMedium}
      initial="hidden"
      animate="show"
    >
      {/* Bento row 1 — Header with insight bar */}
      <motion.div variants={fadeSlideUp}>
        <DashboardHeader showInsightBar />
      </motion.div>

      {/* Bento row 2 — Stat tiles */}
      <motion.div
        className="rounded-2xl bg-bg-primary px-4 py-5"
        variants={fadeSlideUp}
      >
        <StatTileGrid />
      </motion.div>

      {/* Bento row 3 — Application Pipeline */}
      <motion.div
        className="rounded-2xl bg-bg-primary px-4 py-5"
        variants={fadeSlideUp}
      >
        <ApplicationPipeline />
      </motion.div>
    </motion.div>
  );
}
