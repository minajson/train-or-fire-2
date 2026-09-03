import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Every projector screen sits in this frame.
 *
 * Fixed to the viewport and never scrollable: a presentation surface that can
 * scroll is a presentation surface that will, at some point, be projected
 * half-way down a screen. Anything that does not fit has to be redesigned, not
 * scrolled — which is the constraint that keeps these stages spare.
 */
export function StageFrame({
  children,
  className,
  /** Extra room at the bottom when a corner QR is present. */
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative h-dvh w-full overflow-hidden bg-paper text-ink",
        padded && "px-[4vw] py-[4vh]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Small structural label, top-left. The only permanent chrome on stage. */
export function StageMarker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("stage-eyebrow text-ink-3", className)}>{children}</div>
  );
}
