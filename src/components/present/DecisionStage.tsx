"use client";

import { AnimatePresence, motion } from "framer-motion";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { cn } from "@/lib/cn";
import { ROLES, type Role, type Verdict } from "@/lib/content/activity";
import { CountPct, ENTER, MOVE } from "@/lib/motion/primitives";
import type { BoardEntry, PublicSessionState } from "@/lib/types";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Destination zones                                                   */
/* ------------------------------------------------------------------ */

const TONE: Record<Verdict, { label: string; wash: string; edge: string; ink: string }> = {
  train: { label: "Train", wash: "bg-train-wash", edge: "border-train-edge", ink: "text-train" },
  fire: { label: "Fire", wash: "bg-fire-wash", edge: "border-fire-edge", ink: "text-fire" },
};

/**
 * One half of the decision arena.
 *
 * Built as a place rather than a control: a large tinted field with a settled
 * edge, which roles arrive in and stay in. Nothing about it invites a click,
 * because nobody clicks the projector — the room votes on phones and this is
 * where the answer lands.
 */
export function VerdictZone({
  verdict,
  livePct,
  placed,
  highlight = false,
  compact = false,
}: {
  verdict: Verdict;
  /** Share for the role being judged. Null until the facilitator reveals. */
  livePct: number | null;
  /** Roles already settled here, oldest first. */
  placed: BoardEntry[];
  highlight?: boolean;
  compact?: boolean;
}) {
  const tone = TONE[verdict];

  return (
    <motion.div
      animate={{ scale: highlight ? 1 : 0.995 }}
      transition={MOVE}
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border-2 px-[3cqw] py-[3cqh]",
        tone.wash,
        highlight ? "border-current shadow-lift" : tone.edge,
        highlight && tone.ink,
      )}
    >
      <div className={cn("flex shrink-0 items-center gap-[1.4cqw]", tone.ink)}>
        <VerdictMark verdict={verdict} className="h-[6cqh] w-[6cqh]" strokeWidth={2.6} />
        <span className="display text-stage-lg uppercase">{tone.label}</span>
      </div>

      {/*
       * The number gets its own line rather than sharing one with the word.
       * Side by side, a 100px figure and a 45px word fight for the same
       * baseline and the percent sign runs off the edge of the zone.
       */}
      {livePct !== null ? (
        <CountPct
          value={livePct}
          className={cn("display mt-[1.5cqh] shrink-0 text-stage-2xl leading-[0.85] tnum", tone.ink)}
        />
      ) : null}

      {/*
       * During the judging, roles stack up from the floor of the zone — the way
       * things settle into a container, and the way the board fills as the
       * activity runs. On the verdict screen the zones hold nothing else, so
       * the same list takes the centre and the room's judgement is the subject.
       */}
      <div
        className={cn(
          "mt-[2.5cqh] flex min-h-0 flex-1 flex-col",
          compact ? "justify-center" : "justify-end",
        )}
      >
        <ul className={cn("flex flex-col", compact ? "gap-[3.5cqh]" : "gap-[1.8cqh]")}>
          <AnimatePresence initial={false}>
            {placed.map((entry) => (
              <motion.li
                key={entry.roleId}
                layout
                initial={{ opacity: 0, y: -34, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={MOVE}
                className={cn(
                  "flex items-baseline justify-between gap-[1.5cqw] border-t border-current/15",
                  compact ? "pt-[2.4cqh]" : "pt-[1.6cqh]",
                )}
              >
                <span
                  className={cn(
                    "display-loose min-w-0 truncate",
                    compact ? "text-stage-md" : "text-stage-sm",
                  )}
                >
                  {entry.title}
                </span>
                <span
                  className={cn(
                    "display tnum",
                    tone.ink,
                    compact ? "text-stage-lg" : "text-stage-sm",
                  )}
                >
                  {Math.round(verdict === "train" ? entry.trainPct : entry.firePct)}%
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* The decision stage                                                  */
/* ------------------------------------------------------------------ */

function minorityLine(entry: BoardEntry): string | null {
  if (entry.total === 0) return null;
  if (entry.tie) return "The room split exactly in half.";
  if (entry.minorityCount === 0) return "The room was unanimous.";
  if (entry.minorityCount === 1) return "1 person saw this differently.";
  return `${entry.minorityCount} people saw this differently.`;
}

export function DecisionStage({ state, role }: { state: PublicSessionState; role: Role }) {
  const revealed = state.phase === "revealed";
  const entry = state.board.find((b) => b.roleId === role.id) ?? null;
  const index = ROLES.findIndex((r) => r.id === role.id) + 1;

  // A role only ever appears on the board once its own question is revealed,
  // so these two lists are the running record of the room's verdicts.
  const trainPlaced = state.board.filter((b) => b.verdict === "train");
  const firePlaced = state.board.filter((b) => b.verdict === "fire");

  return (
    <StageFrame className="flex flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <span className="stage-eyebrow text-ink-3">
          Decision {String(index).padStart(2, "0")} / {String(ROLES.length).padStart(2, "0")}
        </span>
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="counter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="display text-stage-md text-ink-2 tnum"
            >
              {state.counts.responses}
              <span className="text-ink-3"> / {state.counts.total}</span>
              <span className="stage-eyebrow ml-[1cqw] text-ink-3">Decided</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* The role under judgement. Lifts out of the way on reveal. */}
      <div className="relative mt-[2cqh] min-h-[30cqh] shrink-0">
        <AnimatePresence>
          {!revealed ? (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 44, scale: 0.96, x: entry?.verdict === "fire" ? 70 : -70 }}
              transition={ENTER}
              className="absolute inset-0"
            >
              <h2 className="display text-stage-xl">{role.title}</h2>
              <ul className="mt-[1.8cqh] space-y-[0.5cqh]">
                {role.phoneFacts.map((fact) => (
                  <li key={fact} className="display-loose text-stage-sm text-ink-2">
                    {fact}
                  </li>
                ))}
              </ul>
              <p className="quote mt-[1.8cqh] text-stage-md text-ink">“{role.quote}”</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${role.id}-result`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER, delay: 0.25 }}
              className="absolute inset-0 flex flex-col justify-center"
            >
              <h2 className="display text-stage-lg">{role.title}</h2>
              {entry ? (
                <p className="display-loose mt-[2cqh] text-stage-sm text-ink-3">
                  {minorityLine(entry)}
                </p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-[2cqh] grid min-h-0 flex-1 grid-cols-2 gap-[2cqw]">
        <VerdictZone
          verdict="train"
          livePct={revealed && entry ? entry.trainPct : null}
          placed={trainPlaced}
          highlight={revealed && entry?.verdict === "train"}
        />
        <VerdictZone
          verdict="fire"
          livePct={revealed && entry ? entry.firePct : null}
          placed={firePlaced}
          highlight={revealed && entry?.verdict === "fire"}
        />
      </div>

      {/*
       * No separate "verdict so far" strip.
       *
       * The zones below already hold every role the room has placed, which is
       * the cumulative board doing its own job. A chip row repeating those same
       * names underneath is the same information twice — and two copies of a
       * thing read as clutter long before they read as reinforcement.
       */}
    </StageFrame>
  );
}
