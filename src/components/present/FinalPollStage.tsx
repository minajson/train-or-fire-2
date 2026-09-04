"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { getQuestion } from "@/lib/content/activity";
import { ENTER, MOVE } from "@/lib/motion/primitives";
import { SignalPulse } from "./scene/Industrial";
import type { PublicSessionState } from "@/lib/types";
import { StageFrame } from "./StageFrame";

interface Row {
  id: string;
  label: string;
  pct: number;
  count: number;
}

/**
 * The closing poll, revealed as a live ranking.
 *
 * Rows animate into their finishing order rather than appearing pre-sorted:
 * watching "the machine" sink to the bottom of the list is the point of the
 * question, and a static chart would throw that away.
 */
export function FinalPollStage({ state }: { state: PublicSessionState }) {
  const question = getQuestion(state.stage?.questionId);
  const results = state.results;
  // A revealed question with no votes behind it is not a result. Drawing seven
  // bars at 0% would say the room answered and chose nothing.
  const revealed = state.phase === "revealed" && Boolean(results?.hasVotes);

  const rows: Row[] = (question?.options ?? []).map((o) => {
    const tally = results?.options.find((t) => t.optionId === o.id);
    return { id: o.id, label: o.label, pct: tally?.pct ?? 0, count: tally?.count ?? 0 };
  });

  const ordered = revealed
    ? [...rows].sort((a, b) => b.pct - a.pct || a.label.localeCompare(b.label))
    : rows;

  const leader = revealed ? results?.leadingOptionId : null;

  return (
    <StageFrame className="flex flex-col">
      <div className="flex items-baseline justify-between gap-[2cqw]">
        <h1 className="display text-stage-xl">
          What actually
          <br />
          failed first?
        </h1>
        {!revealed ? (
          <div className="flex shrink-0 items-center gap-[1cqw]">
            <SignalPulse tone="ink" size={11} active={state.status === "live"} />
            <span className="stage-eyebrow text-ink-3">
              {state.phase === "revealed" ? "No votes yet" : "Voting live"}
            </span>
            <span className="display text-stage-md text-ink-2 tnum">
              {state.counts.responses}
              <span className="text-ink-3"> / {state.counts.total}</span>
            </span>
          </div>
        ) : (
          <div className="stage-eyebrow shrink-0 text-ink-3 tnum">
            {results?.totalResponses ?? 0} responses
          </div>
        )}
      </div>

      <ul className="mt-[3cqh] flex min-h-0 flex-1 flex-col gap-[0.7cqh]">
        {ordered.map((row) => {
          const isLeader = row.id === leader;
          return (
            <motion.li
              key={row.id}
              layout
              transition={MOVE}
              className="relative flex min-h-0 flex-1 items-center px-[1cqw]"
            >
              {revealed ? (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(0.004, row.pct / 100) }}
                  transition={{ ...MOVE, delay: 0.2 }}
                  style={{ originX: 0 }}
                  className={cn(
                    "absolute inset-y-[0.35cqh] left-0 right-0 rounded-r-lg",
                    isLeader ? "bg-graphite/18" : "bg-ink/8",
                  )}
                />
              ) : null}

              <span
                className={cn(
                  "relative display-loose min-w-0 flex-1 truncate",
                  isLeader
                    ? "text-stage-md"
                    : "text-stage-sm",
                  revealed && !isLeader && "text-ink-2",
                )}
              >
                {row.label}
              </span>

              {revealed ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...ENTER, delay: 0.35 }}
                  className={cn(
                    "relative ml-[1.5cqw] shrink-0 display tnum",
                    isLeader
                      ? "text-stage-lg"
                      : "text-stage-md text-ink-3",
                  )}
                >
                  {Math.round(row.pct)}%
                </motion.span>
              ) : null}
            </motion.li>
          );
        })}
      </ul>
    </StageFrame>
  );
}
