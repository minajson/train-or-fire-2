"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Verdict } from "@/lib/content/activity";
import { useMotionOff } from "@/lib/motion/primitives";

/**
 * The role, as an object the room can watch move.
 *
 * The brief's word was "physical", and this is what carries it: a role stops
 * being a heading above two rectangles and becomes a solid, edged token with a
 * marker, a name and a weight — something that can be picked up by a decision
 * and put down somewhere. When the reveal happens, this is the thing that
 * travels.
 *
 * Deliberately not a card. It has a hard left rule, tabular marker digits and
 * a single flat fill: a plant tag, not a UI surface.
 */
export function RoleToken({
  marker,
  title,
  verdict = null,
  size = "lg",
  className,
  muted = false,
}: {
  marker?: string;
  title: string;
  /** Tints the tag once the room has placed it. Null while undecided. */
  verdict?: Verdict | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  muted?: boolean;
}) {
  const text =
    size === "lg" ? "text-stage-lg" : size === "md" ? "text-stage-md" : "text-stage-sm";

  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-lg border-2 bg-surface shadow-lift",
        verdict === "train" && "border-train-edge",
        verdict === "fire" && "border-fire-edge",
        verdict === null && "border-rule",
        muted && "opacity-60 shadow-none",
        className,
      )}
    >
      {/* The spine. Colour lives here, never on the name itself, so the tag
          reads the same to someone who cannot separate the two hues. */}
      <span
        aria-hidden="true"
        className={cn(
          "w-[0.8cqw] min-w-[6px] shrink-0",
          verdict === "train" && "bg-train",
          verdict === "fire" && "bg-fire",
          verdict === null && "bg-graphite",
        )}
      />
      <span className="flex min-w-0 flex-col justify-center px-[1.6cqw] py-[1.4cqh]">
        {marker ? (
          <span className="stage-eyebrow text-ink-3 tnum">{marker}</span>
        ) : null}
        <span className={cn("display-loose min-w-0 truncate", text, marker && "mt-[0.6cqh]")}>
          {title}
        </span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The arena                                                           */
/* ------------------------------------------------------------------ */

export type TokenPlacement = Verdict | "split" | null;

/**
 * The token as a layout-animated object.
 *
 * Rendering this in two different places under the same `layoutId` is what
 * makes the reveal a single continuous move: Framer measures the tag where it
 * was, measures where it now is, and springs between the two. Nothing computes
 * a coordinate, which is why it lands correctly on a 1366×768 projector and a
 * 1920×1080 one without a hard-coded offset anywhere.
 */
export function TokenSlot({
  layoutId,
  marker,
  title,
  verdict = null,
  size = "md",
}: {
  layoutId: string;
  marker?: string;
  title: string;
  verdict?: Verdict | null;
  size?: "sm" | "md" | "lg";
}) {
  const reduced = useMotionOff();

  return (
    <motion.div
      layoutId={layoutId}
      layout
      className="inline-block"
      transition={
        reduced
          ? { duration: 0 }
          : // Inside the 500–900ms window the brief set: long enough for a room
            // to follow an object across a projected wall, short enough that
            // the facilitator is never waiting on it.
            { type: "spring", stiffness: 110, damping: 19, mass: 1 }
      }
    >
      <RoleToken marker={marker} title={title} verdict={verdict} size={size} />
    </motion.div>
  );
}

/**
 * Where the token ends up.
 *
 * The motion is the argument. TRAIN lifts — development is upward, and the tag
 * settles into the left field. FIRE leaves — the tag travels laterally, out of
 * the active system, into the right field. A tie sends it to neither, because
 * the room genuinely did not decide, and moving it anyway would put a verdict
 * on the wall that nobody voted for.
 *
 * Renders nothing while the decision is open: the token is still up in the
 * brief, and this is the empty arena it is about to cross.
 */
export function TokenArena({
  marker,
  title,
  placement,
  layoutId,
  className,
}: {
  marker?: string;
  title: string;
  placement: TokenPlacement;
  /** Shared with the token's pre-reveal position, so the two are one object. */
  layoutId: string;
  className?: string;
}) {
  const reduced = useMotionOff();
  const placed = placement === "train" || placement === "fire";

  if (placement === null) return null;

  const token = (
    <TokenSlot
      layoutId={layoutId}
      marker={marker}
      title={title}
      verdict={placed ? placement : null}
      size="md"
    />
  );

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-20 flex items-center", className)}>
      {placed ? (
        <>
          <div className="flex w-1/2 justify-center">{placement === "train" ? token : null}</div>
          <div className="flex w-1/2 justify-center">{placement === "fire" ? token : null}</div>
        </>
      ) : (
        <div className="flex w-full flex-col items-center gap-[1.6cqh]">
          {token}
          <motion.span
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="stage-eyebrow rounded-full border border-rule bg-surface px-[1.4cqw] py-[0.8cqh] text-ink-2 shadow-lift"
          >
            Split decision
          </motion.span>
        </div>
      )}
    </div>
  );
}
