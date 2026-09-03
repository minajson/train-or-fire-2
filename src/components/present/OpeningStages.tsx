"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { INCIDENT_LINES } from "@/lib/content/activity";
import { ENTER, Rise } from "@/lib/motion/primitives";
import type { PublicSessionState } from "@/lib/types";
import { joinUrl, PresenceLine } from "./JoinPanel";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Opening                                                             */
/* ------------------------------------------------------------------ */

/**
 * The title card. TRAIN and FIRE carry their colours here and nowhere earlier,
 * so the room learns the code before it is ever asked to read one.
 */
export function OpeningStage({ beat }: { beat: number }) {
  return (
    <StageFrame className="flex flex-col justify-between">
      <div className="stage-eyebrow text-ink-3">The Warning Signs</div>

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="display text-stage-3xl">
          <motion.span
            className="block text-train"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTER, delay: 0.05 }}
          >
            Train
          </motion.span>
          <motion.span
            className="block text-ink-3"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTER, delay: 0.18 }}
          >
            or
          </motion.span>
          <motion.span
            className="block text-fire"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTER, delay: 0.31 }}
          >
            Fire
          </motion.span>
        </h1>

        <AnimatePresence>
          {beat >= 1 ? (
            <Rise delay={0.1} className="mt-[5vh]">
              <div className="h-px w-[38vw] max-w-[560px] bg-rule" />
              <p className="display-loose mt-[3vh] text-stage-md text-ink-2">
                One failure. Four decisions. You decide.
              </p>
            </Rise>
          ) : null}
        </AnimatePresence>
      </div>

      <div />
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Join                                                                */
/* ------------------------------------------------------------------ */

export function JoinStage({
  state,
  origin,
}: {
  state: PublicSessionState;
  origin: string;
}) {
  const url = origin ? joinUrl(origin, state.code) : "";

  return (
    <StageFrame className="flex flex-col justify-between">
      <div className="stage-eyebrow text-ink-3">Train or Fire</div>

      <div className="flex flex-1 items-center gap-[5vw]">
        <div className="min-w-0 flex-1">
          <h1 className="display text-stage-2xl">
            Scan
            <br />
            to join.
          </h1>

          <div className="mt-[5vh]">
            <div className="stage-eyebrow text-ink-3">Session code</div>
            <div className="font-mono text-stage-xl font-semibold leading-none tracking-tight tnum">
              {state.code}
            </div>
          </div>

          {url ? (
            <div className="mt-[3vh] font-mono text-stage-sm text-ink-2">
              {url.replace(/^https?:\/\//, "")}
            </div>
          ) : null}
        </div>

        {url ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={ENTER}
            className="shrink-0"
          >
            <QrCode value={url} className="h-[56vh] w-[56vh] rounded-2xl" />
          </motion.div>
        ) : null}
      </div>

      <PresenceLine
        total={state.counts.total}
        room={state.counts.room}
        online={state.counts.online}
      />
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The incident                                                        */
/* ------------------------------------------------------------------ */

export function IncidentStage({ beat }: { beat: number }) {
  return (
    <StageFrame className="flex flex-col">
      <div className="stage-eyebrow text-ink-3">The incident</div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="max-w-[80vw] space-y-[2.2vh]">
          {INCIDENT_LINES.slice(0, beat + 1).map((line, i) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: i === beat ? 1 : 0.42, y: 0 }}
              transition={ENTER}
              className="display-loose text-stage-lg"
            >
              {line}
            </motion.p>
          ))}
        </div>
      </div>
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Four people, four decisions                                         */
/* ------------------------------------------------------------------ */

export function PreludeStage({ beat }: { beat: number }) {
  return (
    <StageFrame className="flex flex-col justify-center">
      <h1 className="display text-stage-2xl">
        <Rise>Four people.</Rise>
        <Rise delay={0.12}>Four decisions.</Rise>
      </h1>

      <AnimatePresence>
        {beat >= 1 ? (
          <Rise delay={0.05} className="mt-[6vh]">
            <div className="h-px w-[42vw] max-w-[640px] bg-rule" />
            <p className="display mt-[3.5vh] text-stage-xl text-ink-2">
              What would you do?
            </p>
          </Rise>
        ) : null}
      </AnimatePresence>
    </StageFrame>
  );
}
