"use client";

/**
 * Shared Framer Motion variants & utilities for dashboard animations.
 *
 * Usage:
 *   import { fadeSlideUp, staggerContainer } from "@/lib/motion";
 *   <motion.div variants={staggerContainer} initial="hidden" animate="show">
 *     <motion.div variants={fadeSlideUp}> ... </motion.div>
 *   </motion.div>
 */

import type { Variants, Transition } from "framer-motion";

/* ── Transitions ──────────────────────────────────────────────────────── */

export const springSnappy: Transition = {
  type: "spring",
  damping: 22,
  stiffness: 260,
};

export const springGentle: Transition = {
  type: "spring",
  damping: 20,
  stiffness: 100,
};

/* ── Entrance variants ────────────────────────────────────────────────── */

/** Fade + slide up 20px */
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springGentle },
};

/** Fade + slide from left 20px */
export const fadeSlideRight: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: springGentle },
};

/** Fade + slide from right 20px */
export const fadeSlideLeft: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: springGentle },
};

/** Scale in from 0 (good for circles / badges) */
export const scaleIn: Variants = {
  hidden: { scale: 0, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: springSnappy },
};

/* ── Container variants (orchestrate children stagger) ────────────────── */

/** Fast stagger — 0.08s between children */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/** Medium stagger — 0.12s between children */
export const staggerContainerMedium: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

/** Slow stagger — 0.18s between children (pipeline circles) */
export const staggerContainerSlow: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.15,
    },
  },
};
