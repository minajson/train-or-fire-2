"use client";

import { motion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { joinUrl } from "@/lib/client/app-url";
import { cn } from "@/lib/cn";

export { joinUrl };

/**
 * Full-screen takeover the facilitator can raise at any time, for the moment
 * everyone needs the code at once. The session underneath is untouched — stage,
 * beat, phase and every vote stay exactly where they were, so lowering it
 * returns the room to the same frame.
 *
 * Distinct from the join code in the briefing column, which is up for as long
 * as the room can answer. This is the deliberate "everybody, now" version.
 */
export function JoinOverlay({ origin, code }: { origin: string; code: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="stage-canvas absolute inset-0 z-40 flex items-center justify-center bg-paper"
    >
      <div className="flex w-full max-w-[1500px] items-center justify-between gap-[6cqw] px-[5cqw]">
        <div className="min-w-0">
          <div className="stage-eyebrow text-ink-3">Train or Fire</div>
          <h2 className="display mt-[2cqh] text-stage-2xl">
            Scan
            <br />
            to join.
          </h2>
          <div className="mt-[4cqh]">
            <div className="stage-eyebrow text-ink-3">Session code</div>
            <div className="font-mono text-stage-xl font-semibold leading-none tracking-tight tnum">
              {code}
            </div>
          </div>
          {origin ? (
            <div className="mt-[3cqh] font-mono text-stage-sm text-ink-2">
              {joinUrl(origin, code).replace(/^https?:\/\//, "")}
            </div>
          ) : null}
        </div>
        {origin ? (
          <QrCode
            value={joinUrl(origin, code)}
            className="h-[62cqh] w-[62cqh] shrink-0 rounded-2xl"
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
    <div className={cn("flex items-baseline gap-[3.5cqw]", className)}>
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
          "display leading-none tnum",
          emphasis ? "text-stage-xl" : "text-stage-lg text-ink-2",
        )}
      >
        {value}
      </div>
      <div className="stage-eyebrow mt-[1.4cqh] text-ink-3">{label}</div>
    </div>
  );
}
