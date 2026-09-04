"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MACHINE_VIDEO_SRC } from "@/lib/content/activity";
import { useMotionOff } from "@/lib/motion/primitives";
import { MachineSchematic } from "./MachineSchematic";

/**
 * The incident's left-hand panel: footage if there is any, the schematic if
 * there is not.
 *
 * The important half of this component is the failure mode. The repository
 * ships with no video, most deployments will never have one, and a facilitator
 * standing in front of a room must never discover that difference. So the
 * schematic renders FIRST and stays until a video has actually reached
 * `canplay` — not until it has been requested, not until it has loaded
 * metadata. If the file is missing, the request 404s, `canplay` never fires,
 * and the screen the room is looking at simply never changes. Nothing to catch,
 * nothing to fall back from.
 *
 * When footage does exist it is framed rather than bled to the edges: this is
 * evidence being shown to a room, and evidence sits inside a border.
 */
export function MachinePanel({
  step,
  className,
  /** Restarts playback. Bump it to replay — the incident stage uses the beat. */
  replayKey = 0,
}: {
  step: number;
  className?: string;
  replayKey?: number;
}) {
  const reduced = useMotionOff();
  const [playable, setPlayable] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || !playable) return;
    el.currentTime = 0;
    // Autoplay can be refused even when muted. That is not an error worth
    // reporting to a room — the frame is still on screen.
    void el.play().catch(() => {});
  }, [playable, replayKey]);

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      {/*
       * A 16:9 frame.
       *
       * Fixed at the aspect ratio the footage is generated at, so a clip drops
       * in and fills the frame exactly rather than being cropped by it — and
       * so the schematic inside is composed once, at one shape, instead of
       * floating in a different amount of empty space on every projector.
       */}
      <div
        className={cn(
          "relative max-h-full w-full overflow-hidden rounded-xl border bg-paper-2",
          "aspect-video",
          playable ? "border-ink/15 shadow-lift" : "border-rule",
        )}
      >
        {/* Corner ticks. A framed technical view, not a rounded media card. */}
        <Ticks />

        {/* Kept mounted underneath, so a video that stalls mid-session reveals
            the schematic rather than an empty frame. */}
        <div
          className={cn("absolute inset-0 p-[1.6cqh]", playable && "opacity-0")}
          aria-hidden={playable ? "true" : undefined}
        >
          <MachineSchematic step={step} className="h-full w-full" />
        </div>

        <motion.video
          ref={video}
          src={MACHINE_VIDEO_SRC}
          className="absolute inset-0 h-full w-full object-cover"
          initial={false}
          animate={{ opacity: playable ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.5 }}
          muted
          playsInline
          loop
          preload="auto"
          // No controls, ever: this is a projector, and a control bar fading in
          // over the footage is the fastest way to make a session look unfinished.
          controls={false}
          aria-hidden={playable ? undefined : "true"}
          onCanPlay={() => setPlayable(true)}
          onError={() => setPlayable(false)}
        />
      </div>
    </div>
  );
}

function Ticks() {
  const c = "absolute h-[1.6cqh] w-[1.6cqh] border-ink-3/40";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <span className={cn(c, "left-[0.8cqh] top-[0.8cqh] border-l border-t")} />
      <span className={cn(c, "right-[0.8cqh] top-[0.8cqh] border-r border-t")} />
      <span className={cn(c, "bottom-[0.8cqh] left-[0.8cqh] border-b border-l")} />
      <span className={cn(c, "bottom-[0.8cqh] right-[0.8cqh] border-b border-r")} />
    </div>
  );
}
