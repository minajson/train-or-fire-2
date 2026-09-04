"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CHAIN, SYSTEM_REPLACEMENTS } from "@/lib/content/activity";
import { ENTER, Rise, useMotionOff } from "@/lib/motion/primitives";
import type { PublicSessionState } from "@/lib/types";
import { ChainView } from "./ChainView";
import { SignalPulse } from "./scene/Industrial";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Let's rewind                                                        */
/* ------------------------------------------------------------------ */

/**
 * The causal chain, built one node at a time.
 *
 * The counter in the corner is the argument this stage is making: it is not
 * counting events, it is counting the number of times somebody could have
 * stopped this and did not. Six, by the end.
 */
export function RewindStage({ beat }: { beat: number }) {
  const visible = beat + 1;
  const opportunities = CHAIN.slice(0, visible).filter((l) => l.opportunity).length;
  const current = CHAIN[Math.min(CHAIN.length - 1, beat)]?.n ?? null;

  return (
    <StageFrame className="flex flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <h1 className="display text-stage-lg">Let&rsquo;s rewind.</h1>
        <AnimatePresence>
          {opportunities > 0 ? (
            <motion.div
              key={opportunities}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
              className="flex items-center gap-[1cqw] text-right"
            >
              <SignalPulse tone="signal" size={11} active />
              <div>
                <div className="display tnum text-stage-lg text-signal">{opportunities}</div>
                <div className="stage-eyebrow text-ink-3">
                  {opportunities === 1 ? "Opportunity" : "Opportunities"}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ChainView visibleCount={visible} currentLink={current} className="mt-[3cqh]" />
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Where should the chain have been broken?                            */
/* ------------------------------------------------------------------ */

export function ChainQuestionStage({ state }: { state: PublicSessionState }) {
  const revealed = state.phase === "revealed";
  const results = state.results;
  const hasVotes = Boolean(results?.hasVotes);

  // Percentages only exist once there are votes behind them. Without that
  // guard, a question revealed to an empty room draws seven bars at 0% and
  // reads as a result the room produced.
  const pctByLink =
    revealed && results && hasVotes
      ? Object.fromEntries(results.options.map((o) => [Number(o.optionId.split(":")[1]), o.pct]))
      : null;

  const winner =
    revealed && hasVotes && results?.leadingOptionId && !results.tie
      ? Number(results.leadingOptionId.split(":")[1])
      : null;

  return (
    <StageFrame className="flex flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <h1 className="display max-w-[62%] text-stage-lg">
          Where should the chain have been broken?
        </h1>
        {!revealed ? (
          <div className="flex shrink-0 items-center gap-[1cqw]">
            <SignalPulse tone="ink" size={11} active={state.status === "live"} />
            <span className="stage-eyebrow text-ink-3">Voting live</span>
            <span className="display text-stage-md text-ink-2 tnum">
              {state.counts.responses}
              <span className="text-ink-3"> / {state.counts.total}</span>
            </span>
          </div>
        ) : (
          <div className="stage-eyebrow shrink-0 text-ink-3 tnum">
            {hasVotes ? `${results?.totalResponses} responses` : "No votes yet"}
          </div>
        )}
      </div>

      <ChainView
        visibleCount={CHAIN.length}
        pctByLink={pctByLink}
        winnerLink={winner}
        className="mt-[3cqh]"
      />
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Did you fix the system?                                             */
/* ------------------------------------------------------------------ */

/**
 * The system, drawn as four unchanged conditions.
 *
 * Beats: 0 the question, 1–4 the four replacements arriving, 5 "what happens
 * next time?", 6 the answer.
 *
 * The visual argument is the pairing. A new name arrives on the left — a real
 * change, drawn as a solid tag — and the condition it inherits sits on the
 * right, drawn identically each time and never moving. Four new people, four
 * identical conditions. By the fourth row the room has usually said the last
 * line out loud before the screen does, which is the point.
 */
export function SystemStage({ beat }: { beat: number }) {
  const reduced = useMotionOff();
  const shown = Math.max(0, Math.min(SYSTEM_REPLACEMENTS.length, beat));
  const asking = beat >= 1 + SYSTEM_REPLACEMENTS.length;
  const answered = beat >= 2 + SYSTEM_REPLACEMENTS.length;

  return (
    <StageFrame className="flex flex-col">
      <Rise>
        <p className="display-loose text-stage-sm text-ink-3">You fired the people.</p>
        <h1 className="display mt-[1.5cqh] text-stage-xl">
          Did you fix
          <br />
          the system?
        </h1>
      </Rise>

      <motion.ul
        animate={{ opacity: answered ? 0.4 : 1 }}
        transition={ENTER}
        className="mt-[3.5cqh] flex min-h-0 flex-col gap-[1.2cqh]"
      >
        {SYSTEM_REPLACEMENTS.map((item, i) => {
          const visible = i < shown;
          return (
            <motion.li
              key={item.role}
              initial={false}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={ENTER}
              className="flex items-stretch gap-[1.5cqw]"
            >
              {/* The person: new, and arriving. */}
              <motion.span
                initial={false}
                animate={{ x: visible || reduced ? 0 : -40 }}
                transition={ENTER}
                className={cn(
                  "flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-rule bg-surface shadow-lift",
                  asking ? "py-[0.9cqh]" : "py-[1.3cqh]",
                )}
              >
                <span aria-hidden="true" className="h-full w-[0.5cqw] min-w-1 bg-graphite" />
                <span
                  className={cn(
                    "display-loose min-w-0 truncate px-[1.4cqw]",
                    asking ? "text-stage-sm" : "text-stage-md",
                  )}
                >
                  {item.role}
                </span>
              </motion.span>

              {/* The condition: unchanged, and it does not move. */}
              <span
                className={cn(
                  "flex min-w-0 flex-1 items-center rounded-lg border border-dashed border-fire-edge bg-fire-wash px-[1.4cqw]",
                  asking ? "py-[0.9cqh]" : "py-[1.3cqh]",
                )}
              >
                <span
                  className={cn(
                    "display-loose min-w-0 truncate text-fire",
                    asking ? "text-stage-sm" : "text-stage-md",
                  )}
                >
                  {item.unchanged}
                </span>
              </span>
            </motion.li>
          );
        })}
      </motion.ul>

      <div className="mt-auto pt-[2cqh]">
        <AnimatePresence mode="wait">
          {answered ? (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
            >
              <p className="display-loose text-stage-sm text-fire">
                Same conditions. Same risk.
              </p>
              <h2 className="display mt-[1.4cqh] text-stage-xl">
                The same conditions
                <br />
                can produce
                <br />
                the same failure.
              </h2>
            </motion.div>
          ) : asking ? (
            <motion.h2
              key="question"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={ENTER}
              className="display text-stage-xl text-ink-2"
            >
              What happens next time?
            </motion.h2>
          ) : null}
        </AnimatePresence>
      </div>
    </StageFrame>
  );
}
