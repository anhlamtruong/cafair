"use client";

/**
 * Package Header — section heading for the Package Management page.
 *
 * Matches Figma node 2155:1192 header section.
 * Animation: fade-slide-up entrance.
 */

import { motion } from "framer-motion";
import { fadeSlideUp } from "@/lib/motion";

export function PackageHeader() {
  return (
    <motion.div
      className="rounded-2xl bg-bg-primary px-4 py-5"
      variants={fadeSlideUp}
      initial="hidden"
      animate="show"
    >
      <h1 className="text-[32px] font-bold leading-10 tracking-normal text-neutral-900">
        Your Application Package
      </h1>
    </motion.div>
  );
}
