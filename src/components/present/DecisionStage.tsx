"use client";

import { AnimatePresence, motion } from "framer-motion";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { cn } from "@/lib/cn";
import { EVIDENCE_LINES, type Role, type Verdict } from "@/lib/content/activity";
import { CountPct, ENTER, MOVE } from "@/lib/motion/primitives";
import type { BoardEntry, PublicSessionState } from "@/lib/types";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Evidence panel — visible for the whole judging stage                */
/* ------------------------------------------------------------------ */

/**
 * The scenario, compressed to fragments and parked on the left for the whole
 * decision sequence. Nobody should have to remember the incident from four
 * screens ago in order to judge the fourth role.
 */
export function EvidencePanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex w-[29%] shrink-0 flex-col border-r border-rule bg-paper-2 px-[2.2vw] py-[4vh]",
        className,
      )}
    >
      <div className="stage-eyebrow text-ink-3">The incident</div>
      <ul className="mt-[3.5vh] space-y-[1.9vh]">
        {EVIDENCE_LINES.map((line) => (
          <li
            key={line}
            className="display-loose text-stage-sm text-ink-2"
          >
            {line}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Destination zones                                                   */
/* ------------------------------------------------------------------ */

const TONE: Record<Verdict, { label: string; wash: string; edge: string; ink: string }> = {
  train: {
    label: "Train",
    wash: "bg-train-wash",
    edge: "border-train-edge",
    ink: "text-train",
  },
  fire: {
    label: "Fire",
    wash: "bg-fire-wash",
    edge: "border-fire-edge",
    ink: "text-fire",
  },
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
  /** Share for the role currently being judged. Null while voting is open. */
  livePct,
  /** Roles already settled here, oldest first. */
  placed,
  /** Lifts the winning side at the moment of reveal. */
  highlight = false,
  compact = false,
}: {
  verdict: Verdict;
  livePct: number | null;
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
        "flex min-h-0 flex-col rounded-2xl border-2 px-[1.8vw] py-[2.4vh]",
        tone.wash,
        highlight ? "border-current shadow-lift" : tone.edge,
        highlight && tone.ink,
      )}
    >
      <div className={cn("flex shrink-0 items-center gap-[0.9vw]", tone.ink)}>
        <VerdictMark
          verdict={verdict}
          className="h-[5vh] w-[5vh]"
          strokeWidth={2.6}
        />
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
          className={cn(
            "display mt-[1vh] shrink-0 tnum leading-[0.85]",
            tone.ink,
            "text-stage-2xl",
          )}
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
          "mt-[2vh] flex min-h-0 flex-1 flex-col",
          compact ? "justify-center" : "justify-end",
        )}
      >
        <ul className={cn("flex flex-col", compact ? "gap-[2.4vh]" : "gap-[1.2vh]")}>
          <AnimatePresence initial={false}>
            {placed.map((entry) => (
              <motion.li
                key={entry.roleId}
                layout
                initial={{ opacity: 0, y: -34, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={MOVE}
                className={cn(
                  "flex items-baseline justify-between gap-[1vw] border-t border-current/15",
                  compact ? "pt-[1.8vh]" : "pt-[1.2vh]",
                )}
              >
                <span
                  className={cn(
                    "display-loose min-w-0 truncate",
                    compact
                      ? "text-stage-md"
                      : "text-stage-sm",
                  )}
                >
                  {entry.title}
                </span>
                <span
                  className={cn(
                    "display tnum",
                    tone.ink,
                    compact
                      ? "text-stage-lg"
                      : "text-stage-sm",
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

export function DecisionStage({
  state,
  role,
}: {
  state: PublicSessionState;
  role: Role;
}) {
  const revealed = state.phase === "revealed";
  const entry = state.board.find((b) => b.roleId === role.id) ?? null;

  // A role only ever appears on the board once its own question is revealed,
  // so the two zone lists below are the running record of the room's verdicts.
  const trainPlaced = state.board.filter((b) => b.verdict === "train");
  const firePlaced = state.board.filter((b) => b.verdict === "fire");

  return (
    <StageFrame padded={false} className="flex">
      <EvidencePanel />

      <div className="flex min-w-0 flex-1 flex-col px-[2.8vw] py-[4vh]">
        <header className="flex items-baseline justify-between gap-[2vw]">
          <h1 className="display-loose text-stage-md text-ink-3">
            What would you do?
          </h1>
          <AnimatePresence mode="wait">
            {!revealed ? (
              <motion.div
                key="counter"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="display tnum text-stage-md text-ink-2"
              >
                {state.counts.responses}
                <span className="text-ink-3"> / {state.counts.total}</span>
                <span className="stage-eyebrow ml-[0.8vw] text-ink-3">Decided</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </header>

        {/* The role under judgement. Lifts out of the way on reveal. */}
        <div className="relative mt-[2.5vh] min-h-[24vh]">
          <AnimatePresence>
            {!revealed ? (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: 44,
                  scale: 0.96,
                  x: entry?.verdict === "fire" ? 70 : -70,
                }}
                transition={ENTER}
                className="absolute inset-0"
              >
                <div className="stage-eyebrow text-ink-3">{role.marker}</div>
                <h2 className="display mt-[1.2vh] text-stage-xl">
                  {role.title}
                </h2>
                <p className="quote mt-[2vh] text-stage-md text-ink-2">
                  “{role.quote}”
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`${role.id}-result`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...ENTER, delay: 0.25 }}
                className="absolute inset-0 flex flex-col justify-center"
              >
                <div className="stage-eyebrow text-ink-3">{role.marker}</div>
                <h2 className="display mt-[1.2vh] text-stage-lg">
                  {role.title}
                </h2>
                {entry ? (
                  <p className="display-loose mt-[2vh] text-stage-sm text-ink-3">
                    {minorityLine(entry)}
                  </p>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-[2.5vh] grid min-h-0 flex-1 grid-cols-2 gap-[1.4vw]">
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
      </div>
    </StageFrame>
  );
}
