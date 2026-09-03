"use client";

import { motion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { joinUrl } from "@/lib/client/app-url";
import { cn } from "@/lib/cn";
import { ENTER } from "@/lib/motion/primitives";

export { joinUrl };

/**
 * The small join code that sits in the corner during voting.
 *
 * Deliberately the only thing on a projector stage that is allowed to be
 * small — it is addressed to one late arrival at a time, not to the room. It
 * never appears on a reveal, an AAR screen or a closing screen, where it would
 * compete with the thing everyone is supposed to be looking at.
 */
export function CornerJoin({ origin, code }: { origin: string; code: string }) {
  if (!origin) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={ENTER}
      className="absolute bottom-[3vh] right-[3vw] flex items-center gap-3 rounded-xl bg-surface p-2.5 shadow-lift"
    >
      {/*
        Smaller in-image margin than the default: this code sits on its own
        white card whose padding is real quiet zone, and at 8vh every module
        that goes to margin comes off the modules a camera has to resolve.
      */}
      <QrCode
        value={joinUrl(origin, code)}
        size={256}
        margin={2}
        className="h-[8vh] w-[8vh] min-h-14 min-w-14"
      />
      <div className="pr-1">
        <div className="eyebrow text-ink-3">Join</div>
        <div className="font-mono text-[max(1.1rem,1.6vh)] font-semibold leading-none tracking-tight tnum">
          {code}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Full-screen takeover the facilitator can raise at any time. The session
 * underneath is untouched — stage, beat, phase and every vote stay exactly
 * where they were, so lowering it returns the room to the same frame.
 */
export function JoinOverlay({ origin, code }: { origin: string; code: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-paper px-[5vw]"
    >
      <div className="flex w-full max-w-[1500px] items-center justify-between gap-[6vw]">
        <div className="min-w-0">
          <div className="stage-eyebrow text-ink-3">Train or Fire</div>
          <h2 className="display mt-[2vh] text-stage-2xl">
            Scan
            <br />
            to join.
          </h2>
          <div className="mt-[4vh] flex items-baseline gap-[2vw]">
            <div>
              <div className="stage-eyebrow text-ink-3">Session code</div>
              <div className="font-mono text-stage-xl font-semibold leading-none tracking-tight tnum">
                {code}
              </div>
            </div>
          </div>
          {origin ? (
            <div className="mt-[3vh] font-mono text-stage-sm text-ink-2">
              {joinUrl(origin, code).replace(/^https?:\/\//, "")}
            </div>
          ) : null}
        </div>
        {origin ? (
          <QrCode
            value={joinUrl(origin, code)}
            className="h-[62vh] w-[62vh] shrink-0 rounded-2xl"
          />
        ) : null}
      </div>
    </motion.div>
  );
}

/** Room / online tally, shown while the room is joining. */
export function PresenceLine({
  total,
  room,
  online,
  className,
}: {
  total: number;
  room: number;
  online: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-[2.5vw]", className)}>
      <Metric value={total} label="In the session" emphasis />
      <Metric value={room} label="In the room" />
      <Metric value={online} label="Online" />
    </div>
  );
}

function Metric({
  value,
  label,
  emphasis = false,
}: {
  value: number;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "display tnum leading-none",
          emphasis
            ? "text-stage-xl"
            : "text-stage-lg text-ink-2",
        )}
      >
        {value}
      </div>
      <div className="stage-eyebrow mt-[1vh] text-ink-3">{label}</div>
    </div>
  );
}
