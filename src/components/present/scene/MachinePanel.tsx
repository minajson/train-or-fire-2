"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MACHINE_VIDEO_SRC } from "@/lib/content/activity";
import { useMotionOff } from "@/lib/motion/primitives";
import { MachineSchematic } from "./MachineSchematic";

/**
 * The failure, as footage — the one moment in the session that is not drawn.
 *
 * It takes the whole stage. Fifteen seconds of real rotating equipment coming
 * apart is the strongest evidence this activity has, and putting it in a panel
 * beside a column of text spends it, because the room reads the text. So this
 * beat carries nothing else, the frame runs as large as the projector allows,
 * and the narrative begins on the beat after.
 *
 * The important half of the component is still the failure mode. Most
 * deployments will never have a file here, and a facilitator standing in front
 * of a room must never discover that difference. The schematic renders FIRST
 * and stays until a video has actually reached `canplay` — not until it has
 * been requested, not until metadata has loaded. With no file the request 404s,
 * `canplay` never fires, and the beat is simply the machine drawn rather than
 * filmed. Nothing to catch, nothing to fall back from.
 */
export function MachineFootage({
  step,
  className,
  /** Changing this restarts playback. The stage passes the beat. */
  playKey = 0,
}: {
  step: number;
  className?: string;
  playKey?: number;
}) {
  const reduced = useMotionOff();
  const [playable, setPlayable] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || !playable) return;
    el.currentTime = 0;
    // Autoplay can be refused even when muted. That is not an error worth
    // reporting to a room — the frame is still on screen, holding frame one.
    void el.play().catch(() => {});
  }, [playable, playKey]);

  return (
    <div className={cn("flex min-h-0 items-center justify-center", className)}>
      {/*
       * `h-full`, NOT `w-full`.
       *
       * The frame has to be exactly 16:9 so that the clip fills it edge to
       * edge and no mat is ever visible — a strip of dark either side of the
       * image is precisely the "video player" look this is meant not to have.
       *
       * With `w-full`, width wins and `max-h-full` then clamps the height, so
       * `aspect-video` loses and the frame comes out at whatever ratio the
       * stage happens to be — 2.09:1 on a 1366×768 projector, which pillarboxes
       * the footage. Driving from the height instead lets the aspect ratio
       * compute the width, and every projector shape wider than 16:9 — which
       * both 1366×768 and 1920×1080 are, once the header is taken off — gets a
       * frame the clip fits perfectly. `max-w-full` is the guard for the case
       * that is not: there, the image letterboxes rather than distorting,
       * because `object-contain` never stretches.
       */}
      <div
        className={cn(
          "relative aspect-video h-full max-w-full overflow-hidden rounded-lg",
          /*
           * A warm near-black mat rather than paper. The clip is 16:9 inside a
           * 16:9 frame so none of this should ever show; if a rounding pixel
           * does, it reads as the edge of the image rather than as a hole in
           * the page. This is the only dark surface in the product, and it is
           * dark because footage sits on black everywhere else in the world.
           */
          "bg-graphite shadow-raise",
        )}
      >
        {/* The drawn machine, underneath, for as long as there is no footage. */}
        <div
          className={cn(
            "absolute inset-0 bg-paper-2 p-[2cqh] transition-opacity duration-500",
            playable && "opacity-0",
          )}
          aria-hidden={playable ? "true" : undefined}
        >
          <MachineSchematic step={step} className="h-full w-full" />
        </div>

        <motion.video
          ref={video}
          src={MACHINE_VIDEO_SRC}
          /*
           * `object-contain`, never `cover`. The clip is exactly 16:9 today, so
           * the two are identical — but a replacement at 4:3 or 2.39:1 would be
           * silently cropped by `cover`, and what `cover` crops from a shot of
           * a machine is the machine.
           */
          className="absolute inset-0 h-full w-full object-contain"
          initial={false}
          animate={{ opacity: playable ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.6 }}
          muted
          playsInline
          preload="auto"
          /*
           * Plays once and holds its last frame — the machine stopped, warning
           * indicators active, production interrupted. That still image is the
           * scenario the room then spends forty minutes on, so it stays up
           * rather than looping back to a healthy machine.
           *
           * No controls, and none of the chrome a browser hangs around them: a
           * play bar fading in over the footage is the fastest way to make a
           * session look unfinished.
           */
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden={playable ? undefined : "true"}
          onCanPlay={() => setPlayable(true)}
          onError={() => setPlayable(false)}
        />
      </div>
    </div>
  );
}

/**
 * The schematic in a framed technical view, for the beats where the narrative
 * is read beside it.
 *
 * No video here. The footage has had its moment, and a second copy of it
 * running under the text would take the room's eyes off the line the
 * facilitator is reading.
 */
export function MachineFrame({ step, className }: { step: number; className?: string }) {
  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div className="relative aspect-video max-h-full w-full overflow-hidden rounded-xl border border-rule bg-paper-2">
        <Ticks />
        <div className="absolute inset-0 p-[1.6cqh]">
          <MachineSchematic step={step} className="h-full w-full" />
        </div>
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
