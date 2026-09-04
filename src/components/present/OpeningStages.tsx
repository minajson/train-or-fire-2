"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { INCIDENT_LINES, MACHINE_STEPS } from "@/lib/content/activity";
import { ENTER, Rise, useMotionOff } from "@/lib/motion/primitives";
import type { PublicSessionState } from "@/lib/types";
import { joinUrl, PresenceLine } from "./JoinPanel";
import { AmbientLinework, SignalPulse, WarningWave } from "./scene/Industrial";
import { MachinePanel } from "./scene/MachinePanel";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Opening                                                             */
/* ------------------------------------------------------------------ */

/**
 * The title card. TRAIN and FIRE carry their colours here and nowhere earlier,
 * so the room learns the code before it is ever asked to read one.
 *
 * The two words also learn their directions here. TRAIN rises with a short
 * upward trail; FIRE arrives laterally with a trail running off to the right.
 * By the time the room reaches its first decision, the geometry of the arena
 * is already familiar and nobody has had to be told it.
 */
export function OpeningStage({ beat }: { beat: number }) {
  const reduced = useMotionOff();

  return (
    <StageFrame className="flex flex-col justify-between">
      <AmbientLinework />

      <div className="relative stage-eyebrow text-ink-3">The Warning Signs</div>

      <div className="relative flex flex-1 flex-col justify-center">
        <h1 className="display text-stage-3xl">
          {/* TRAIN — up, and staying in. */}
          <span className="relative block">
            <motion.span
              aria-hidden="true"
              className="absolute left-0 top-0 block h-full w-[0.4cqw] min-w-0.75 bg-train/25"
              initial={reduced ? false : { scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1 }}
              transition={{ ...ENTER, delay: 0.05 }}
              style={{ originY: 1 }}
            />
            <motion.span
              className="block pl-[2cqw] text-train"
              initial={{ opacity: 0, y: reduced ? 0 : 48 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER, delay: 0.05 }}
            >
              Train
            </motion.span>
          </span>

          <motion.span
            className="block pl-[2cqw] text-ink-3"
            initial={{ opacity: 0, y: reduced ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTER, delay: 0.18 }}
          >
            or
          </motion.span>

          {/* FIRE — out, and leaving. */}
          <span className="relative block">
            <motion.span
              aria-hidden="true"
              className="absolute left-0 top-1/2 block h-[0.4cqh] min-h-0.75 w-[46cqw] bg-fire/20"
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ ...ENTER, delay: 0.34 }}
              style={{ originX: 0 }}
            />
            <motion.span
              className="relative block pl-[2cqw] text-fire"
              initial={{ opacity: 0, x: reduced ? 0 : -44 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...ENTER, delay: 0.31 }}
            >
              Fire
            </motion.span>
          </span>
        </h1>

        <AnimatePresence>
          {beat >= 1 ? (
            <Rise delay={0.1} className="mt-[5cqh]">
              <div className="h-px w-[38cqw] max-w-[560px] bg-rule" />
              <p className="display-loose mt-[3cqh] text-stage-md text-ink-2">
                One failure.
                <br />
                Four decisions.
                <br />
                You decide.
              </p>
            </Rise>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative flex items-center gap-[1.2cqw]">
        <SignalPulse tone="ink" size={10} active />
        <WarningWave amplitude={0.22} className="h-[4cqh] w-[26cqw]" speed={5} />
      </div>
    </StageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Join                                                                */
/* ------------------------------------------------------------------ */

/**
 * The QR stays the subject. The linework behind it is at 5–9% ink and stops
 * short of the code entirely — a scanner that has to find a quiet zone through
 * a background pattern is a room that cannot join, and nothing on this screen
 * is worth that.
 */
export function JoinStage({ state, origin }: { state: PublicSessionState; origin: string }) {
  const url = origin ? joinUrl(origin, state.code) : "";

  return (
    <StageFrame className="flex flex-col justify-between">
      <AmbientLinework intensity={0.7} />

      <div className="relative stage-eyebrow text-ink-3">Train or Fire</div>

      <div className="relative flex flex-1 items-center gap-[5cqw]">
        <div className="min-w-0 flex-1">
          <h1 className="display text-stage-2xl">
            Scan
            <br />
            to join.
          </h1>

          <div className="mt-[5cqh]">
            <div className="stage-eyebrow text-ink-3">Session code</div>
            <div className="font-mono text-stage-xl font-semibold leading-none tracking-tight tnum">
              {state.code}
            </div>
          </div>

          {url ? (
            <div className="mt-[3cqh] font-mono text-stage-sm text-ink-2">
              {url.replace(/^https?:\/\//, "")}
            </div>
          ) : null}

          <div className="mt-[4cqh] flex items-center gap-[1.2cqw]">
            <SignalPulse tone="ink" size={10} active={state.status === "live"} />
            <WarningWave amplitude={0.18} className="h-[3.5cqh] w-[20cqw]" speed={6} />
          </div>
        </div>

        {url ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={ENTER}
            /* Opaque, and it owns its own ground. Whatever is drawn behind this
               stage stops at the QR's edge. */
            className="shrink-0 rounded-2xl bg-paper p-[1.5cqh] shadow-lift"
          >
            <QrCode value={url} className="h-[52cqh] w-[52cqh] rounded-lg" />
          </motion.div>
        ) : null}
      </div>

      <PresenceLine
        className="relative"
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

/**
 * The incident, as a scene rather than a wall of text.
 *
 * Left: the machine — footage if a file has been dropped in, the animated
 * schematic otherwise. It walks its condition sequence in step with the
 * narrative, so the room watches the deterioration described on the right
 * happening on the left. The temporary stabilisation at step five is the beat
 * that does the work: the trace drops back, and then it comes back worse.
 *
 * Right: the same seven lines, one per beat, unchanged from the script.
 */
export function IncidentStage({ beat }: { beat: number }) {
  const step = Math.min(MACHINE_STEPS.length - 1, beat);

  return (
    <StageFrame className="flex flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <span className="stage-eyebrow text-ink-3">The incident</span>
        <span className="stage-eyebrow text-ink-3 tnum">
          {String(Math.min(beat + 1, INCIDENT_LINES.length)).padStart(2, "0")} /{" "}
          {String(INCIDENT_LINES.length).padStart(2, "0")}
        </span>
      </div>

      {/*
       * Both columns start at the same line.
       *
       * The narrative grows a line per beat and the frame does not, so
       * centring the two against each other means the machine drifts down the
       * screen as the story is told. Sharing a top edge keeps the scene still
       * while the text builds — which is the only thing that should be moving.
       */}
      <div className="mt-[2.5cqh] grid min-h-0 flex-1 grid-cols-[minmax(0,46%)_minmax(0,1fr)] items-start gap-[3cqw]">
        <MachinePanel step={step} replayKey={beat === 0 ? 0 : 1} className="min-h-0 w-full" />

        <div className="flex min-h-0 flex-col">
          <div className="space-y-[1.8cqh]">
            {INCIDENT_LINES.slice(0, beat + 1).map((line, i) => (
              <motion.p
                key={line}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: i === beat ? 1 : 0.38, y: 0 }}
                transition={ENTER}
                className="display-loose text-stage-md"
              >
                {line}
              </motion.p>
            ))}
          </div>
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
      <AmbientLinework intensity={0.6} />

      <h1 className="relative display text-stage-2xl">
        <Rise>Four people.</Rise>
        <Rise delay={0.12}>Four decisions.</Rise>
      </h1>

      <AnimatePresence>
        {beat >= 1 ? (
          <Rise delay={0.05} className="relative mt-[6cqh]">
            <div className="h-px w-[42cqw] max-w-[640px] bg-rule" />
            <p className="display mt-[3.5cqh] text-stage-xl text-ink-2">What would you do?</p>
          </Rise>
        ) : null}
      </AnimatePresence>
    </StageFrame>
  );
}
