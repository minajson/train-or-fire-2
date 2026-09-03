"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CHAIN, type ChainLink } from "@/lib/content/activity";
import { ENTER, MOVE } from "@/lib/motion/primitives";

export interface ChainRowState {
  /** Not yet reached by the build. Occupies its slot, shows nothing. */
  hidden?: boolean;
  /** Share of the vote, 0–100. Draws the bar. */
  pct?: number | null;
  /** The room's answer. Grows and takes the colour. */
  winner?: boolean;
  /** Pushed back so the winner reads first. */
  muted?: boolean;
}

/**
 * One link in the failure chain.
 *
 * The layout is identical whether the chain is being told (the rewind) or
 * voted on (where should it have broken) — the row simply gains a bar and a
 * percentage. Reusing the row is what lets the room map its vote straight back
 * onto the sequence it just watched being built.
 */
function ChainRow({
  link,
  state = {},
}: {
  link: ChainLink;
  state?: ChainRowState;
}) {
  const { hidden, pct, winner, muted } = state;
  // Link 7 is the failure itself — it was never an option to vote for, so it
  // never carries a bar or a percentage, only the outcome.
  const showBar = typeof pct === "number" && !link.terminal;

  return (
    <motion.li
      animate={{
        opacity: hidden ? 0 : muted ? 0.72 : 1,
        y: hidden ? 14 : 0,
      }}
      initial={false}
      transition={ENTER}
      className="relative flex min-h-0 flex-1 items-center"
      aria-hidden={hidden ? "true" : undefined}
    >
      {/* Vote share, drawn as ground beneath the row rather than as a chart. */}
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

      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center font-mono font-semibold tnum",
          "h-[4.4cqh] w-[4.4cqh] min-h-8 min-w-8 rounded-md text-[max(0.8rem,1.6vh)]",
          link.terminal
            ? "bg-fire text-white"
            : winner
              ? "bg-graphite text-paper"
              : "bg-surface text-ink-2 ring-1 ring-rule",
        )}
      >
        {link.n}
      </div>

      <div className="relative ml-[1.4cqw] min-w-0 flex-1">
        <div
          className={cn(
            "display-loose truncate",
            winner
              ? "text-stage-md"
              : "text-stage-sm",
            link.terminal && "text-fire",
          )}
        >
          {link.title}
        </div>
        <div className="truncate text-stage-xs text-ink-3">
          {link.detail.join(" ")}
        </div>
      </div>

      {showBar ? (
        <div
          className={cn(
            "relative ml-[1.5cqw] shrink-0 display tnum",
            winner
              ? "text-stage-lg text-ink"
              : "text-stage-md text-ink-3",
          )}
        >
          {Math.round(pct ?? 0)}%
        </div>
      ) : link.opportunity ? (
        <div className="relative ml-[1.5cqw] shrink-0">
          <span className="inline-block rounded-full bg-signal-wash px-[1.1cqw] py-[0.8cqh] text-stage-sm font-semibold uppercase tracking-[0.08em] text-signal">
            {link.opportunity}
          </span>
        </div>
      ) : null}
    </motion.li>
  );
}

/**
 * The whole chain. Every slot is rendered from the start and revealed in place,
 * so the sequence grows downward without the rows above it shifting — a
 * reflowing timeline on a projector reads as a glitch, not as motion.
 */
export function ChainView({
  /** Rows 0..visibleCount-1 are shown. Pass CHAIN.length to show all. */
  visibleCount,
  /** optionId-independent: pct per link number, when voting has been revealed. */
  pctByLink,
  winnerLink,
  className,
}: {
  visibleCount: number;
  pctByLink?: Record<number, number> | null;
  winnerLink?: number | null;
  className?: string;
}) {
  return (
    <ol className={cn("relative flex min-h-0 flex-1 flex-col gap-[0.8cqh]", className)}>
      {/* The spine. Centred on the number chips, inset so it does not overrun. */}
      <div
        aria-hidden="true"
        className="absolute bottom-[4cqh] left-[2.2cqh] top-[4cqh] w-px bg-rule"
      />
      {CHAIN.map((link, i) => (
        <ChainRow
          key={link.n}
          link={link}
          state={{
            hidden: i >= visibleCount,
            pct: pctByLink ? (pctByLink[link.n] ?? 0) : null,
            winner: winnerLink === link.n,
            muted: Boolean(winnerLink) && winnerLink !== link.n && !link.terminal,
          }}
        />
      ))}
    </ol>
  );
}
