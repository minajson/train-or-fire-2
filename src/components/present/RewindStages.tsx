"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CHAIN, SYSTEM_REPLACEMENTS } from "@/lib/content/activity";
import { ENTER, Rise } from "@/lib/motion/primitives";
import type { PublicSessionState } from "@/lib/types";
import { ChainView } from "./ChainView";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Let's rewind                                                        */
/* ------------------------------------------------------------------ */

export function RewindStage({ beat }: { beat: number }) {
  const visible = beat + 1;
  const opportunities = CHAIN.slice(0, visible).filter((l) => l.opportunity).length;

  return (
    <StageFrame className="flex flex-col">
      <div className="flex items-baseline justify-between gap-[2cqw]">
        <h1 className="display text-stage-lg">Let&rsquo;s rewind.</h1>
        <AnimatePresence>
          {opportunities > 0 ? (
            <motion.div
              key={opportunities}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
              className="text-right"
            >
              <div className="display tnum text-stage-lg text-signal">
                {opportunities}
              </div>
              <div className="stage-eyebrow text-ink-3">
                {opportunities === 1 ? "Opportunity" : "Opportunities"}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ChainView visibleCount={visible} className="mt-[3cqh]" />
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Where should the chain have been broken?                            */
/* ------------------------------------------------------------------ */

export function ChainQuestionStage({ state }: { state: PublicSessionState }) {
  const revealed = state.phase === "revealed";
  const results = state.results;

  const pctByLink = revealed && results
    ? Object.fromEntries(
        results.options.map((o) => [Number(o.optionId.split(":")[1]), o.pct]),
      )
    : null;

  const winner =
    revealed && results?.leadingOptionId
      ? Number(results.leadingOptionId.split(":")[1])
      : null;

  return (
    <StageFrame className="flex flex-col">
      <div className="flex items-baseline justify-between gap-[2cqw]">
        <h1 className="display max-w-[62%] text-stage-lg">
          Where should the chain have been broken?
        </h1>
        {!revealed ? (
          <div className="display tnum shrink-0 text-stage-md text-ink-2">
            {state.counts.responses}
            <span className="text-ink-3"> / {state.counts.total}</span>
            <span className="stage-eyebrow ml-[0.8cqw] text-ink-3">Decided</span>
          </div>
        ) : (
          <div className="stage-eyebrow shrink-0 text-ink-3">
            {results?.totalResponses ?? 0} responses
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
 * Beats: 0 the question, 1–4 the four replacements, 5 "what happens next
 * time?", 6 the answer. As the question takes over, the four replacement lines
 * recede rather than disappearing — they are the evidence for the last line.
 */
export function SystemStage({ beat }: { beat: number }) {
  const shown = Math.max(0, Math.min(SYSTEM_REPLACEMENTS.length, beat));
  const asking = beat >= 1 + SYSTEM_REPLACEMENTS.length;
  const answered = beat >= 2 + SYSTEM_REPLACEMENTS.length;

  return (
    <StageFrame className="flex flex-col">
      <Rise>
        <p className="display-loose text-stage-sm text-ink-3">
          You fired the people.
        </p>
        <h1 className="display mt-[1.5cqh] text-stage-xl">
          Did you fix
          <br />
          the system?
        </h1>
      </Rise>

      <motion.ul
        animate={{ opacity: answered ? 0.42 : 1 }}
        transition={ENTER}
        className="mt-[4cqh] space-y-[1.6cqh]"
      >
        {SYSTEM_REPLACEMENTS.map((item, i) => (
          <motion.li
            key={item.role}
            initial={false}
            animate={{ opacity: i < shown ? 1 : 0, y: i < shown ? 0 : 12 }}
            transition={ENTER}
            className="flex flex-wrap items-baseline gap-x-[1.6cqw] gap-y-[0.4cqh]"
          >
            <span
              className={cn(
                "display-loose",
                asking
                  ? "text-stage-sm"
                  : "text-stage-md",
              )}
            >
              {item.role}
            </span>
            <span
              className={cn(
                "display-loose text-fire",
                asking
                  ? "text-stage-sm"
                  : "text-stage-md",
              )}
            >
              {item.unchanged}
            </span>
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-auto">
        <AnimatePresence mode="wait">
          {answered ? (
            <motion.h2
              key="answer"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
              className="display text-stage-xl"
            >
              The same conditions
              <br />
              can produce
              <br />
              the same failure.
            </motion.h2>
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
