"use client";

import { AnimatePresence, motion } from "framer-motion";
import { COST_ITEMS, FINAL_TRUTHS, LEARNINGS } from "@/lib/content/activity";
import { ENTER, Rise } from "@/lib/motion/primitives";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Key learning reveals                                                */
/* ------------------------------------------------------------------ */

export function LearningStage({ index, beat }: { index: number; beat: number }) {
  const learning = LEARNINGS[index];
  if (!learning) return <StageFrame />;

  return (
    <StageFrame className="flex flex-col justify-center">
      <div className="stage-eyebrow text-ink-3">
        {String(index + 1).padStart(2, "0")} / {String(LEARNINGS.length).padStart(2, "0")}
      </div>

      <h1 className="display mt-[3cqh] text-stage-2xl">
        {learning.headline.map((line, i) => (
          <Rise key={line} delay={i * 0.1}>
            {line}
          </Rise>
        ))}
      </h1>

      <AnimatePresence>
        {beat >= 1 ? (
          <Rise className="mt-[5cqh] max-w-[64cqw]">
            <div className="h-px w-[30cqw] max-w-[440px] bg-rule" />
            <p className="display-loose mt-[3cqh] text-stage-md text-ink-2">
              {learning.body}
            </p>
          </Rise>
        ) : null}
      </AnimatePresence>
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The cost reframe                                                    */
/* ------------------------------------------------------------------ */

export function CostClaimStage() {
  return (
    <StageFrame className="flex flex-col justify-center">
      <Rise>
        <p className="quote text-stage-2xl leading-[0.98]">
          “We couldn&rsquo;t afford
          <br />
          the maintenance.”
        </p>
      </Rise>
    </StageFrame>
  );
}

/**
 * Six consequences, one per beat, with no figures on any of them.
 *
 * The brief was explicit about inventing no monetary values, and it is right
 * to be: a made-up number is the one thing in this session an engineer in the
 * room could disprove, and disproving it would take the whole argument with it.
 */
export function CostRealityStage({ beat }: { beat: number }) {
  const shown = Math.max(0, Math.min(COST_ITEMS.length, beat));

  return (
    <StageFrame className="flex flex-col">
      <Rise>
        <p className="quote text-stage-sm text-ink-3">
          “We couldn&rsquo;t afford the maintenance.”
        </p>
        <h1 className="display mt-[2cqh] text-stage-2xl">
          Can we afford
          <br />
          the failure?
        </h1>
      </Rise>

      <ul className="mt-[5cqh] flex min-h-0 flex-1 flex-col justify-start gap-[0.4cqh] border-l-2 border-fire pl-[2cqw]">
        {COST_ITEMS.map((item, i) => (
          <motion.li
            key={item}
            initial={false}
            animate={{ opacity: i < shown ? 1 : 0, x: i < shown ? 0 : -14 }}
            transition={ENTER}
            className="display-loose py-[0.9cqh] text-stage-md"
          >
            {item}
          </motion.li>
        ))}
      </ul>
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Final message                                                       */
/* ------------------------------------------------------------------ */

export function FinalMachineStage({ beat }: { beat: number }) {
  return (
    <StageFrame className="flex flex-col justify-center">
      <h1 className="display text-stage-2xl">
        <Rise>The machine</Rise>
        <Rise delay={0.12}>failed last.</Rise>
      </h1>

      <AnimatePresence>
        {beat >= 1 ? (
          <Rise className="mt-[6cqh]">
            <div className="h-px w-[36cqw] max-w-[520px] bg-rule" />
            <p className="display-loose mt-[3cqh] text-stage-md text-ink-2">
              Before the trip came
              <br />
              warnings, decisions, missed opportunities
              <br />
              and competing priorities.
            </p>
          </Rise>
        ) : null}
      </AnimatePresence>
    </StageFrame>
  );
}

export function TruthStage({ beat }: { beat: number }) {
  const shown = Math.min(FINAL_TRUTHS.length, beat + 1);

  return (
    <StageFrame className="flex flex-col justify-center gap-[4cqh]">
      {FINAL_TRUTHS.map((truth, i) => {
        const last = i === FINAL_TRUTHS.length - 1;
        return (
          <motion.div
            key={truth.lead + truth.body.join()}
            initial={false}
            animate={{
              opacity: i < shown ? (last || i === shown - 1 ? 1 : 0.4) : 0,
              y: i < shown ? 0 : 18,
            }}
            transition={ENTER}
          >
            <p className="display-loose text-stage-sm text-ink-3">
              {truth.lead}
            </p>
            <p
              className={
                last
                  ? "display mt-[1cqh] text-stage-xl text-fire"
                  : "display mt-[1cqh] text-stage-lg"
              }
            >
              {truth.body.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </motion.div>
        );
      })}
    </StageFrame>
  );
}

export function ClosingStage({ beat }: { beat: number }) {
  return (
    <StageFrame className="flex flex-col justify-center">
      <h1 className="display text-stage-3xl">
        <Rise>
          <span className="text-train">Train</span> <span className="text-ink-3">or</span>{" "}
          <span className="text-fire">Fire</span>
        </Rise>
      </h1>

      <AnimatePresence>
        {beat >= 1 ? (
          <Rise className="mt-[6cqh]">
            <div className="h-px w-[40cqw] max-w-[600px] bg-rule" />
            <p className="display-loose mt-[3.5cqh] text-stage-lg text-ink-2">
              What would you do differently
              <br />
              before the next warning?
            </p>
          </Rise>
        ) : null}
      </AnimatePresence>
    </StageFrame>
  );
}
