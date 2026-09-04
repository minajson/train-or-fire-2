"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Motion vocabulary for the projector.
 *
 * Three transitions, used everywhere. A screen that borrows a fourth easing
 * curve stops feeling like the same product, and an audience reads that
 * inconsistency as cheapness long before they can name it.
 *
 * The one exception is the decision token crossing the arena, which carries
 * its own softer spring: it is a heavier object than a line of copy rising
 * into place, and it has to travel for the 500–900ms a room needs to follow
 * something across a projected wall rather than snapping into position.
 */
export const ENTER: Transition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] };
export const MOVE: Transition = { type: "spring", stiffness: 220, damping: 26, mass: 0.9 };
export const QUICK: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

/**
 * True when the viewer has asked for less motion.
 *
 * Everything in this file and in the 2D scenes reads this and strips the
 * journey while keeping the destination: tokens still land in their zone,
 * counters still reach their number, the machine still ends up failed. Nothing
 * in the activity is comprehensible only if you watched it move.
 */
export function useMotionOff(): boolean {
  return useReducedMotion() ?? false;
}

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
  const reduced = useMotionOff();
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
 * `enabled` is the load-bearing argument, and callers are expected to think
 * about it. A count-up belongs to the MOMENT of a reveal. Replaying it every
 * time a result comes back on screen means that for a second after every Back,
 * the wall reads a number far below the one the room actually chose — which is
 * the visible half of the bug this release exists to fix. So a result being
 * re-shown passes `enabled={false}` and lands on its real figure immediately.
 *
 * With animation off (reduced motion, or `enabled` false) the final value is
 * returned straight from render: no extra pass, nothing to tear down, and the
 * destination is never lost.
 */
export function useCountUp(value: number, duration = 1100, enabled = true): number {
  const reduced = useMotionOff();
  const animate = enabled && !reduced;
  const [display, setDisplay] = useState(animate ? 0 : value);
  const frame = useRef<number | null>(null);
  const from = useRef(animate ? 0 : value);

  useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    const origin = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Same curve as ENTER: fast out of the gate, settling at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + (value - origin) * eased;
      from.current = t < 1 ? next : value;
      setDisplay(next);
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
