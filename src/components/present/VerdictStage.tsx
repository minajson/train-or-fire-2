"use client";

import { AnimatePresence, motion } from "framer-motion";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { cn } from "@/lib/cn";
import { CHAIN, ROLES, type Verdict } from "@/lib/content/activity";
import { CountPct, ENTER, Rise, useMotionOff } from "@/lib/motion/primitives";
import type { BoardEntry, PublicSessionState } from "@/lib/types";
import { AmbientLinework } from "./scene/Industrial";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* The decision wall                                                   */
/* ------------------------------------------------------------------ */

const WALL: Record<Verdict, { label: string; wash: string; edge: string; ink: string }> = {
  train: { label: "Train", wash: "bg-train-wash", edge: "border-train-edge", ink: "text-train" },
  fire: { label: "Fire", wash: "bg-fire-wash", edge: "border-fire-edge", ink: "text-fire" },
};

/**
 * One role's card on the wall.
 *
 * Slight depth and a coloured spine, so four of these read as four objects
 * placed on a surface rather than four rows of a table. The percentage is the
 * share for the side the card is standing on — the losing share stays visible
 * underneath it, because the minority is where the discussion is.
 */
function VerdictCard({
  entry,
  verdict,
  delay,
}: {
  entry: BoardEntry;
  verdict: Verdict;
  delay: number;
}) {
  const reduced = useMotionOff();
  const tone = WALL[verdict];
  const mine = verdict === "train" ? entry.trainPct : entry.firePct;
  const theirs = verdict === "train" ? entry.firePct : entry.trainPct;
  const otherLabel = verdict === "train" ? "Fire" : "Train";

  return (
    <motion.li
      layout
      initial={reduced ? false : { opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...ENTER, delay: reduced ? 0 : delay }}
      className="flex items-stretch overflow-hidden rounded-xl border border-rule bg-surface shadow-lift"
    >
      <span
        aria-hidden="true"
        className={cn("w-[0.7cqw] min-w-[5px] shrink-0", verdict === "train" ? "bg-train" : "bg-fire")}
      />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-[1.5cqw] px-[1.8cqw] py-[1.8cqh]">
        <div className="min-w-0">
          <div className="display-loose min-w-0 text-stage-sm leading-tight">{entry.title}</div>
          <div className="stage-eyebrow mt-[0.9cqh] truncate text-ink-3 tnum">
            {otherLabel} {Math.round(theirs)}% · {entry.total} decided
          </div>
        </div>
        {/*
         * Landed, not counted up. Every figure on this wall has already been
         * revealed once; replaying the sweep would mean four cards reading 0%
         * for a second on the one screen whose entire job is to show the room
         * what it decided.
         */}
        <CountPct
          value={mine}
          enabled={false}
          className={cn("display shrink-0 text-stage-lg leading-none tnum", tone.ink)}
        />
      </div>
    </motion.li>
  );
}

function WallColumn({
  verdict,
  entries,
}: {
  verdict: Verdict;
  entries: BoardEntry[];
}) {
  const tone = WALL[verdict];

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border-2 px-[2.2cqw] py-[2.6cqh]",
        tone.wash,
        tone.edge,
      )}
    >
      <div className={cn("flex shrink-0 items-center gap-[1.2cqw]", tone.ink)}>
        <VerdictMark verdict={verdict} className="h-[5cqh] w-[5cqh]" strokeWidth={2.6} />
        <span className="display text-stage-lg uppercase">{tone.label}</span>
        <span className="stage-eyebrow ml-auto shrink-0 whitespace-nowrap tnum opacity-70">
          {entries.length} {entries.length === 1 ? "role" : "roles"}
        </span>
      </div>

      <ul className="mt-[2.4cqh] flex min-h-0 flex-1 flex-col justify-center gap-[1.6cqh]">
        <AnimatePresence initial={false}>
          {entries.length > 0 ? (
            entries.map((entry) => (
              <VerdictCard
                key={entry.roleId}
                entry={entry}
                verdict={verdict}
                delay={entry.order * 0.16}
              />
            ))
          ) : (
            <li className="display-loose text-center text-stage-sm text-ink-3/70">
              Nobody.
            </li>
          )}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/**
 * Roles the room did not resolve — an exact tie, or a decision that was
 * revealed with no votes behind it.
 *
 * These used to be quietly assigned to TRAIN at 0% and stood on the wall
 * looking exactly like a verdict. They are not one, so they sit between the
 * two columns and say what they are.
 */
function UnresolvedRail({ entries }: { entries: BoardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-col justify-center gap-[1.4cqh]">
      {entries.map((entry) => (
        <motion.div
          key={entry.roleId}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...ENTER, delay: entry.order * 0.16 }}
          className="rounded-xl border border-dashed border-rule bg-paper-2/70 px-[0.9cqw] py-[1.6cqh] text-center"
        >
          <div className="display-loose text-stage-xs leading-tight">{entry.title}</div>
          <div className="stage-eyebrow mt-[1cqh] text-ink-3">
            {entry.hasVotes ? "Split" : "Pending"}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * The completed board.
 *
 * No new information — every number here has already been on screen once, and
 * every one of them is the number that was on screen, read back from the
 * snapshot taken when the room saw it. The job of this screen is to put all
 * four judgements in one frame so the room can see the shape of its own
 * reasoning, which is what the discussion needs.
 *
 * A role that has not been decided is simply not here yet. It is never drawn
 * as a resolved verdict, and never as 0%.
 */
export function VerdictStage({ state }: { state: PublicSessionState }) {
  const trainPlaced = state.board.filter((b) => b.placement === "train");
  const firePlaced = state.board.filter((b) => b.placement === "fire");
  const unresolved = state.board.filter(
    (b) => b.placement === "split" || b.placement === "pending",
  );
  const undecided = ROLES.filter((role) => !state.board.some((b) => b.roleId === role.id));

  return (
    <StageFrame className="flex flex-col">
      <AmbientLinework intensity={0.5} />

      <div className="relative flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <Rise>
          <h1 className="display text-stage-xl">This is our verdict.</h1>
        </Rise>
        {undecided.length > 0 ? (
          <span className="stage-eyebrow shrink-0 text-ink-3">
            {undecided.length} still to decide
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "relative mt-[3.5cqh] grid min-h-0 flex-1 gap-[1.8cqw]",
          /*
           * `minmax(0,…)` on every track, not `1fr`. A bare `1fr` floors at the
           * column's min-content width, so the side holding "Managing Director"
           * quietly grows and the other side is squeezed — the two halves of a
           * verdict must be the same size or the wall is arguing for one of them.
           */
          unresolved.length > 0
            ? "grid-cols-[minmax(0,1fr)_minmax(0,15%)_minmax(0,1fr)]"
            : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        <WallColumn verdict="train" entries={trainPlaced} />
        {unresolved.length > 0 ? <UnresolvedRail entries={unresolved} /> : null}
        <WallColumn verdict="fire" entries={firePlaced} />
      </div>

      {/*
       * Roles the room has not reached. Named, so the wall is honest about
       * being incomplete rather than looking like a finished four-way split.
       */}
      {undecided.length > 0 ? (
        <div className="relative mt-[2.4cqh] flex shrink-0 flex-wrap items-center gap-[1.2cqw]">
          <span className="stage-eyebrow text-ink-3">Not yet decided</span>
          {undecided.map((role) => (
            <span
              key={role.id}
              className="display-loose rounded-full border border-dashed border-rule px-[1.2cqw] py-[0.6cqh] text-stage-xs text-ink-3"
            >
              {role.title}
            </span>
          ))}
        </div>
      ) : null}
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The turn                                                            */
/* ------------------------------------------------------------------ */

/**
 * Two sentences, one at a time, with nothing else on screen.
 *
 * The first line is an accusation the room has just earned. The second is the
 * question the rest of the session answers. Anything else on this screen —
 * a chart, a caption, a logo — would give people somewhere to look instead.
 *
 * The one addition is the departure, and it is the AAR's whole thesis stated
 * in motion before it is stated in words. The roles the room fired slide off
 * the right edge as the second line lands — and what is revealed behind them
 * is the failure chain, ghosted, every link still in place. The people leave.
 * The conditions do not.
 *
 * The chain sits at 7% ink and never animates. It is there to be noticed
 * half-consciously, and to be pointed at afterwards; a room that reads it
 * instead of the question has been given a second thing to look at on the one
 * screen that must only have one.
 */
export function TwistStage({ beat, board }: { beat: number; board: BoardEntry[] }) {
  const reduced = useMotionOff();
  const asked = beat >= 1;
  const fired = board.filter((b) => b.placement === "fire");

  return (
    <StageFrame className="flex flex-col justify-center">
      <AnimatePresence mode="wait">
        {!asked ? (
          <motion.div
            key="fired"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={ENTER}
          >
            <h1 className="display text-stage-3xl">
              You fired
              <br />
              someone.
            </h1>
            {fired.length > 0 ? (
              <ul className="mt-[5cqh] flex flex-wrap gap-[1.2cqw]">
                {fired.map((entry, i) => (
                  <motion.li
                    key={entry.roleId}
                    initial={reduced ? false : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...ENTER, delay: 0.4 + i * 0.12 }}
                    className="flex items-stretch overflow-hidden rounded-lg bg-surface shadow-lift"
                  >
                    <span aria-hidden="true" className="w-[0.5cqw] min-w-1 shrink-0 bg-fire" />
                    <span className="display-loose px-[1.4cqw] py-[1cqh] text-stage-sm">
                      {entry.title}
                    </span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
          </motion.div>
        ) : (
          <motion.div key="fixed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...ENTER, delay: 0.05 }}
              className="display-loose text-stage-md text-ink-3"
            >
              You fired someone.
            </motion.p>

            {/* The departure. They go; nothing else does. */}
            {fired.length > 0 ? (
              <div className="relative mt-[2cqh] h-[9cqh]">
                {fired.map((entry, i) => (
                  <motion.span
                    key={entry.roleId}
                    initial={reduced ? { opacity: 0 } : { opacity: 1, x: 0 }}
                    animate={reduced ? { opacity: 0 } : { opacity: 0, x: "120cqw" }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: [0.65, 0, 0.35, 1] }}
                    className="absolute flex items-stretch overflow-hidden whitespace-nowrap rounded-lg bg-surface shadow-lift"
                    style={{ top: `${i * 2.4}cqh` }}
                  >
                    <span aria-hidden="true" className="w-[0.5cqw] min-w-1 shrink-0 bg-fire" />
                    <span className="display-loose px-[1.4cqw] py-[1cqh] text-stage-sm text-ink-3">
                      {entry.title}
                    </span>
                  </motion.span>
                ))}
              </div>
            ) : null}

            <motion.h1
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER, delay: 0.22 }}
              className="display mt-[3cqh] text-stage-3xl text-fire"
            >
              Did you fix
              <br />
              the problem?
            </motion.h1>

            {/*
             * The system, still standing, under where the people were.
             *
             * Along the floor of the screen rather than behind the headline:
             * a ghost that overlaps the question is a second thing to read on
             * the one screen that must only have one, and this needs to be
             * noticed half-consciously and pointed at afterwards, not competed
             * with. Every link still in place. The people left; the conditions
             * did not.
             */}
            <motion.ol
              aria-hidden="true"
              initial={reduced ? { opacity: 0.14 } : { opacity: 0 }}
              animate={{ opacity: 0.14 }}
              transition={{ duration: 1.4, delay: 0.9 }}
              className="pointer-events-none absolute bottom-[3cqh] left-[4cqw] right-[11cqw] flex items-center gap-[0.6cqw]"
            >
              {CHAIN.map((link, i) => (
                <li
                  key={link.n}
                  className={cn(
                    "flex shrink-0 items-center gap-[0.7cqw]",
                    /*
                     * `flex-auto`, never `flex-1`. `flex-1` sets a zero basis,
                     * so every link would be given the SAME width regardless of
                     * how long its label is — and the long ones then overflow
                     * into their neighbours. `flex-auto` starts from the content
                     * and shares out only the space left over, which is what
                     * lets seven links of very different lengths sit on one
                     * line without a single collision.
                     */
                    i < CHAIN.length - 1 && "min-w-0 flex-auto",
                  )}
                >
                  <span className="flex h-[3.4cqh] w-[3.4cqh] min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-ink font-mono text-[max(0.65rem,1.2vh)] font-semibold tnum">
                    {link.n}
                  </span>
                  <span className="display-loose shrink-0 whitespace-nowrap text-stage-xs">
                    {link.short}
                  </span>
                  {i < CHAIN.length - 1 ? (
                    <span className="h-px min-w-[1cqw] flex-1 bg-ink" />
                  ) : null}
                </li>
              ))}
            </motion.ol>
          </motion.div>
        )}
      </AnimatePresence>
    </StageFrame>
  );
}
