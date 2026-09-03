"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { joinUrl } from "@/lib/client/app-url";
import { cn } from "@/lib/cn";
import {
  EVIDENCE_LINES,
  INCIDENT_BRIEF,
  type PanelMode,
} from "@/lib/content/activity";
import { ENTER } from "@/lib/motion/primitives";

/**
 * The left column of the projector shell.
 *
 * It holds two things for the whole session: what happened, and how to join.
 * Neither is ever more than a glance away, which is what lets the right-hand
 * stage carry one idea at a time without the room losing its footing.
 */
export function BriefingPanel({
  mode,
  showJoin,
  origin,
  code,
}: {
  mode: PanelMode;
  /** Driven by `requiresParticipantResponse` — see PublicSessionState. */
  showJoin: boolean;
  origin: string;
  code: string;
}) {
  return (
    /*
     * The padding lives on the inner wrapper, not on the container.
     * Container-query units inside a container's OWN properties resolve
     * against the nearest *ancestor* container — and with none above, against
     * the viewport. Putting `px-[7cqw]` on the aside itself gave it 95px of
     * side padding on a 410px column and squeezed the briefing text down to
     * its 16px floor.
     */
    <aside className="brief-canvas relative h-full w-[30%] shrink-0 border-r border-rule bg-paper-2">
      <div className="flex h-full flex-col px-[7cqw] py-[5cqh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={ENTER}
            className="min-h-0 flex-1"
          >
            {mode === "briefing" ? (
              <Incident />
            ) : mode === "known" ? (
              <WhatWeKnow />
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/*
        The join code stays up for as long as the room can answer. A latecomer
        walking in during decision three should not need the facilitator to stop
        and put a code back on screen for them.
      */}
        <AnimatePresence>
          {showJoin ? <JoinBlock origin={origin} code={code} /> : null}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function Incident() {
  return (
    <div>
      <h2 className="font-mono text-[length:var(--text-brief-label)] font-medium uppercase tracking-[0.24em] text-ink-3">
        The incident
      </h2>
      <div className="mt-[3.5cqh] space-y-[2.4cqh]">
        {INCIDENT_BRIEF.map((line, i) => (
          <p
            key={i}
            className="text-[length:var(--text-brief-body)] leading-[1.32] text-ink-2"
          >
            {line.map((run, j) =>
              run.b ? (
                <strong key={j} className="font-bold text-ink">
                  {run.t}
                </strong>
              ) : (
                <span key={j}>{run.t}</span>
              ),
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

function WhatWeKnow() {
  return (
    <div>
      <h2 className="font-mono text-[length:var(--text-brief-label)] font-medium uppercase tracking-[0.24em] text-ink-3">
        What we know
      </h2>
      <ul className="mt-[3.5cqh] space-y-[2.2cqh]">
        {EVIDENCE_LINES.map((line) => (
          <li
            key={line}
            className="display-loose text-[length:var(--text-brief-body)] text-ink-2"
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function JoinBlock({ origin, code }: { origin: string; code: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={ENTER}
      className="mt-[4cqh] shrink-0"
    >
      <div className="h-px w-full bg-rule" />
      <div className="mt-[3cqh] flex items-end gap-[4cqw]">
        {origin ? (
          <QrCode
            value={joinUrl(origin, code)}
            size={512}
            className={cn(
              "shrink-0 rounded-lg",
              // Big enough to read off a projected surface from the back of the
              // room, bounded on height so a short projector cannot crowd it.
              "w-[min(60cqw,24cqh)]",
            )}
          />
        ) : null}
        <div className="shrink-0 whitespace-nowrap pb-[0.5cqh]">
          <div className="font-mono text-[length:var(--text-brief-label)] font-medium uppercase tracking-[0.2em] text-ink-3">
            Join
          </div>
          <div className="display mt-[1cqh] text-[length:var(--text-brief-code)] leading-none tnum">
            {code}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
