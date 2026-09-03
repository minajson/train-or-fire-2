"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Motion vocabulary for the projector.
 *
 * Three transitions, used everywhere. A screen that borrows a fourth easing
 * curve stops feeling like the same product, and an audience reads that
 * inconsistency as cheapness long before they can name it.
 */
export const ENTER: Transition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] };
export const MOVE: Transition = { type: "spring", stiffness: 220, damping: 26, mass: 0.9 };
export const QUICK: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

/** A line that rises into place. The default entrance for stage copy. */
export function Rise({
  children,
  delay = 0,
  distance = 26,
  className,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : distance }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -distance * 0.5 }}
      transition={{ ...ENTER, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts to `value` over `duration`.
 *
 * Driven by rAF against wall-clock time rather than a per-frame increment, so
 * the number lands exactly on target even if the projector drops frames — and
 * it always lands, which matters when the whole room is reading it.
 *
 * When animation is off (reduced motion, or a caller that just wants the
 * figure) the final value is returned straight from render, so there is no
 * extra pass and nothing to tear down.
 */
export function useCountUp(value: number, duration = 1100, enabled = true): number {
  const reduced = useReducedMotion();
  const animate = enabled && !reduced;
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Same curve as ENTER: fast out of the gate, settling at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, animate]);

  return animate ? display : value;
}

/** Whole-number percentage, counted up. */
export function CountPct({
  value,
  className,
  enabled = true,
}: {
  value: number;
  className?: string;
  enabled?: boolean;
}) {
  const n = useCountUp(value, 1100, enabled);
  return (
    <span className={className}>
      <span className="tnum">{Math.round(n)}</span>
      <span aria-hidden="true">%</span>
    </span>
  );
}
