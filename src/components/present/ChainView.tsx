"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CHAIN, type ChainLink } from "@/lib/content/activity";
import { ENTER, MOVE, useMotionOff } from "@/lib/motion/primitives";
import { RiskMarker } from "./scene/Industrial";

export interface ChainRowState {
  /** Not yet reached by the build. Occupies its slot, shows nothing. */
  hidden?: boolean;
  /** The node the chain has just reached. Enlarges slightly. */
  current?: boolean;
  /** Share of the vote, 0–100. Draws the bar. */
  pct?: number | null;
  /** The room's answer. Grows and takes the colour. */
  winner?: boolean;
  /** Pushed back so the winner reads first. */
  muted?: boolean;
}

/**
 * One node in the failure chain.
 *
 * The layout is identical whether the chain is being told (the rewind) or
 * voted on (where should it have broken) — the node simply gains a bar and a
 * percentage in place of its break marker. Reusing the node is what lets the
 * room map its vote straight back onto the sequence it just watched being
 * built, which is the only reason the vote means anything.
 *
 * Each node is a real object: a numbered plate, a body with a rule beneath it,
 * and a connector arriving from the node above. Nodes already passed stay on
 * screen but recede — the chain is cumulative, and an AAR that erases its own
 * history as it goes is not an AAR.
 */
function ChainNode({
  link,
  state = {},
  isLast,
}: {
  link: ChainLink;
  state?: ChainRowState;
  isLast: boolean;
}) {
  const reduced = useMotionOff();
  const { hidden, current, pct, winner, muted } = state;
  // Link 7 is the failure itself — it was never an option to vote for, so it
  // never carries a bar or a percentage, only the outcome.
  const showBar = typeof pct === "number" && !link.terminal;

  return (
    <motion.li
      initial={false}
      animate={{
        opacity: hidden ? 0 : muted ? 0.66 : current ? 1 : 0.88,
        x: hidden ? -18 : 0,
      }}
      transition={ENTER}
      className="relative flex min-h-0 flex-1 items-center"
      aria-hidden={hidden ? "true" : undefined}
    >
      {/* Vote share, drawn as ground beneath the node rather than as a chart. */}
      {showBar ? (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.max(0.004, (pct ?? 0) / 100) }}
          transition={{ ...MOVE, delay: 0.15 }}
          style={{ originX: 0 }}
          className={cn(
            "absolute inset-y-[0.4cqh] left-0 right-0 rounded-r-lg",
            winner ? "bg-graphite/18" : "bg-ink/8",
          )}
        />
      ) : null}

      {/* The connector arriving from the node above, drawn in as it is reached. */}
      {!isLast ? (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ scaleY: hidden ? 0 : 1, opacity: hidden ? 0 : 1 }}
          transition={{ duration: reduced ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
          style={{ originY: 0 }}
          className={cn(
            "absolute left-[2.2cqh] top-1/2 h-[calc(100%+0.8cqh)] w-px",
            link.terminal ? "bg-fire/40" : "bg-rule",
          )}
        />
      ) : null}

      <motion.div
        initial={false}
        animate={{ scale: current ? 1.1 : 1 }}
        transition={MOVE}
        className={cn(
          "relative flex shrink-0 items-center justify-center font-mono font-semibold tnum",
          "h-[4.4cqh] w-[4.4cqh] min-h-8 min-w-8 rounded-md text-[max(0.8rem,1.6vh)]",
          link.terminal
            ? "bg-fire text-white shadow-lift"
            : winner
              ? "bg-graphite text-paper shadow-lift"
              : current
                ? "bg-ink text-paper shadow-lift"
                : "bg-surface text-ink-2 ring-1 ring-rule",
        )}
      >
        {link.n}
      </motion.div>

      <div className="relative ml-[1.4cqw] min-w-0 flex-1">
        <div
          className={cn(
            "display-loose truncate",
            winner || current ? "text-stage-md" : "text-stage-sm",
            link.terminal && "text-fire",
          )}
        >
          {link.title}
        </div>
        <div className="truncate text-stage-xs text-ink-3">{link.detail.join(" ")}</div>
      </div>

      {showBar ? (
        <div
          className={cn(
            "relative ml-[1.5cqw] shrink-0 display tnum",
            winner ? "text-stage-lg text-ink" : "text-stage-md text-ink-3",
          )}
        >
          {Math.round(pct ?? 0)}%
        </div>
      ) : link.opportunity ? (
        <motion.div
          initial={false}
          animate={{ opacity: hidden ? 0 : 1, x: hidden ? 10 : 0 }}
          transition={{ ...ENTER, delay: reduced ? 0 : 0.18 }}
          className="relative ml-[1.5cqw] shrink-0"
        >
          <RiskMarker label={link.opportunity} active={Boolean(current)} />
        </motion.div>
      ) : null}
    </motion.li>
  );
}

/**
 * The whole chain. Every slot is rendered from the start and revealed in place,
 * so the sequence grows downward without the nodes above it shifting — a
 * reflowing timeline on a projector reads as a glitch, not as motion.
 */
export function ChainView({
  /** Nodes 0..visibleCount-1 are shown. Pass CHAIN.length to show all. */
  visibleCount,
  /** optionId-independent: pct per link number, when voting has been revealed. */
  pctByLink,
  winnerLink,
  /** The node the build has just reached. Enlarges; the rest recede. */
  currentLink,
  className,
}: {
  visibleCount: number;
  pctByLink?: Record<number, number> | null;
  winnerLink?: number | null;
  currentLink?: number | null;
  className?: string;
}) {
  return (
    <ol className={cn("relative flex min-h-0 flex-1 flex-col gap-[0.8cqh]", className)}>
      {CHAIN.map((link, i) => (
        <ChainNode
          key={link.n}
          link={link}
          isLast={i === CHAIN.length - 1}
          state={{
            hidden: i >= visibleCount,
            current: currentLink === link.n,
            pct: pctByLink ? (pctByLink[link.n] ?? 0) : null,
            winner: winnerLink === link.n,
            muted: Boolean(winnerLink) && winnerLink !== link.n && !link.terminal,
          }}
        />
      ))}
    </ol>
  );
}
