import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The stage: the right-hand canvas of the projector shell.
 *
 * Every screen of the activity renders in here, and nothing else about the
 * projector moves. That is the whole idea — the audience should feel they never
 * left one Train or Fire experience, and the facilitator should never feel they
 * navigated to a different page.
 *
 * Never scrollable. A presentation surface that can scroll is one that will, at
 * some point, be projected half-way down a screen. Anything that does not fit
 * has to be redesigned, not scrolled — which is the constraint that keeps these
 * screens spare.
 */
export function StageFrame({
  children,
  className,
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative h-full w-full overflow-hidden text-ink",
        padded && "px-[4cqw] py-[6cqh]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Small structural label. The only place small text belongs on stage. */
export function StageMarker({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("stage-eyebrow text-ink-3", className)}>{children}</div>;
}
