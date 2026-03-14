"use client";

/**
 * Stat Tile Grid — 4 summary cards in a flex-wrap row.
 *
 * First tile ("New Role Matches") has a gradient background; the other
 * three have a white background.
 *
 * Matches Figma node 2172:1258.
 */

import { cn } from "@/lib/utils";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { fadeSlideUp, staggerContainer } from "@/lib/motion";
import { ArrowUpRight } from "lucide-react"; /* TODO:icons — replace with exact Figma SVG */
import { useEffect, useRef } from "react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface StatTile {
  title: string;
  value: string | number;
  description: string;
  footer: string;
  /** "featured" = gradient bg, white text. "default" = white bg, dark text. */
  variant: "featured" | "default";
}

/* ── Mock data (all values are hard-coded) ────────────────────────────── */

const TILES: StatTile[] = [
  {
    title: "New Role Matches",
    value: 12 /* TODO: Hard code value */,
    description:
      "Explore AI-matched roles tailored to your experience and preferences",
    footer: "3 new this week" /* TODO: Hard code value */,
    variant: "featured",
  },
  {
    title: "Application Package",
    value: "0%" /* TODO: Hard code value */,
    description:
      "Complete your profile to unlock AI-matched roles and start your job search",
    footer: "Start now to unlock matchings",
    variant: "default",
  },
  {
    title: "Applications",
    value: 4 /* TODO: Hard code value */,
    description: "Track your application status and upcoming interviews",
    footer: "1 interview scheduled" /* TODO: Hard code value */,
    variant: "default",
  },
  {
    title: "Actions Needed",
    value: 0 /* TODO: Hard code value */,
    description: "Review items that need your immediate attention",
    footer: "Requires attention",
    variant: "default",
  },
];

/* ── Component ────────────────────────────────────────────────────────── */

export function StatTileGrid() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-wrap gap-4"
    >
      {TILES.map((tile) => (
        <motion.div
          key={tile.title}
          variants={fadeSlideUp}
          className="flex min-w-0 flex-1"
        >
          <StatTileCard tile={tile} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function StatTileCard({ tile }: { tile: StatTile }) {
  const isFeatured = tile.variant === "featured";

  return (
    <div
      className={cn(
        "group flex w-full min-w-0 flex-col justify-between rounded-[14px] px-3 pb-3 pt-4",
        "h-[222px]", // TODO: Hard code value
        "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        isFeatured && "hover:shadow-brand-900/20",
        !isFeatured && "bg-neutral-0",
      )}
      style={
        isFeatured
          ? {
              /* TODO-hard code color — gradient from brand-700 to brand-900 */
              backgroundImage:
                "linear-gradient(-11deg, var(--brand-700) 10%, var(--brand-900) 73%)",
            }
          : undefined
      }
      data-variant={tile.variant}
    >
      {/* Header: title + link icon */}
      <div className="flex w-full items-center justify-between">
        <p
          className={cn(
            "text-base font-semibold leading-[19.5px] tracking-[-0.08px]",
            isFeatured ? "font-bold text-neutral-0" : "text-neutral-900",
          )}
        >
          {tile.title}
        </p>

        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border",
            isFeatured
              ? "border-none bg-neutral-0 shadow-sm"
              : "border-text-brand bg-neutral-0",
          )}
        >
          {/* TODO:icons — replace with Figma arrow-top-right SVG */}
          <ArrowUpRight
            className={cn(
              "size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
              isFeatured ? "text-text-brand" : "text-text-brand",
            )}
          />
        </div>
      </div>

      {/* Big number */}
      <p
        className={cn(
          "text-[32px] font-bold leading-[42px] tracking-[0.38px]",
          isFeatured ? "text-neutral-0" : "text-neutral-900",
        )}
      >
        {typeof tile.value === "number" ? (
          <CountUp target={tile.value} />
        ) : (
          tile.value
        )}
      </p>

      {/* Description */}
      <p
        className={cn(
          "w-full text-base font-medium leading-6",
          isFeatured ? "text-neutral-0" : "text-text-secondary",
        )}
      >
        {tile.description}
      </p>

      {/* Footer */}
      <p
        className={cn(
          "text-sm font-normal leading-[16.5px] tracking-[0.06px]",
          isFeatured ? "text-text-ondark" : "text-text-tertiary",
        )}
      >
        {tile.footer}
      </p>
    </div>
  );
}

/* ── CountUp ──────────────────────────────────────────────────────────── */

/** Animates from 0 to `target` using framer-motion spring. */
function CountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(motionVal, target, {
      type: "spring",
      damping: 20,
      stiffness: 100,
      duration: 1.2,
    });
    return controls.stop;
  }, [motionVal, target]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
    return unsub;
  }, [rounded]);

  return <span ref={ref}>0</span>;
}
