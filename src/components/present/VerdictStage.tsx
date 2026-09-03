"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ENTER, Rise } from "@/lib/motion/primitives";
import type { PublicSessionState } from "@/lib/types";
import { VerdictZone } from "./DecisionStage";
import { StageFrame } from "./StageFrame";

/**
 * The completed board.
 *
 * No new information — every number here has already been on screen once. The
 * job of this screen is to put all four judgements in one frame so the room can
 * see the shape of its own reasoning, which is what the discussion needs.
 */
export function VerdictStage({ state }: { state: PublicSessionState }) {
  const trainPlaced = state.board.filter((b) => b.verdict === "train");
  const firePlaced = state.board.filter((b) => b.verdict === "fire");

  return (
    <StageFrame className="flex flex-col">
      <Rise>
        <h1 className="display text-stage-xl">This is our verdict.</h1>
      </Rise>

      <div className="mt-[4cqh] grid min-h-0 flex-1 grid-cols-2 gap-[2cqw]">
        <VerdictZone verdict="train" livePct={null} placed={trainPlaced} compact />
        <VerdictZone verdict="fire" livePct={null} placed={firePlaced} compact />
      </div>
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
 */
export function TwistStage({ beat }: { beat: number }) {
  const asked = beat >= 1;

  return (
    <StageFrame className="flex flex-col justify-center">
      <AnimatePresence mode="wait">
        {!asked ? (
          <motion.h1
            key="fired"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={ENTER}
            className="display text-stage-3xl"
          >
            You fired
            <br />
            someone.
          </motion.h1>
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
          </motion.div>
        )}
      </AnimatePresence>
    </StageFrame>
  );
}
