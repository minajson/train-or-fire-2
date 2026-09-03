"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { PanelMode } from "@/lib/content/activity";
import { BriefingPanel } from "./BriefingPanel";

/**
 * The projector, and there is only one of it.
 *
 * A header that never moves, a briefing column that changes twice in a session,
 * and a stage that carries everything else. The room should never experience a
 * page transition, and the facilitator should never feel they are navigating a
 * deck — they are moving one screen forward.
 */
export function ProjectorShell({
  children,
  panel,
  showJoin,
  origin,
  code,
  counts,
  live,
  nav,
  overlay,
}: {
  children: ReactNode;
  panel: PanelMode;
  showJoin: boolean;
  origin: string;
  code: string;
  counts: { total: number };
  live: boolean;
  nav?: ReactNode;
  /**
   * Takes the whole projector, not just the stage. Rendered here rather than
   * among the children because the stage is a positioned container — an
   * `inset-0` overlay dropped inside it covers 70% of the screen and leaves the
   * briefing column showing, which is not what "show everyone the code" means.
   */
  overlay?: ReactNode;
}) {
  /*
   * The briefing column earns its width while it has something to say. On the
   * screens that carry a single sentence it collapses away entirely, so the
   * stage gets the whole projector for the moments that need it.
   */
  const briefing = panel !== "quiet";

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-paper">
      <header className="flex shrink-0 items-baseline justify-between border-b border-rule px-[2.2vw] py-[1.6vh]">
        <span className="display-loose text-[clamp(0.8rem,1.15vw,1.4rem)] uppercase tracking-tight">
          Train <span className="text-ink-3">or</span> Fire
        </span>
        <span className="stage-eyebrow flex items-center gap-[0.8vw] text-ink-3">
          <span className="flex items-center gap-[0.4vw]">
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-train" : "bg-ink-3")}
            />
            {live ? "Live" : "Standing by"}
          </span>
          <span aria-hidden="true" className="text-rule">
            •
          </span>
          <span className="tnum">{counts.total} joined</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {briefing ? (
          <BriefingPanel mode={panel} showJoin={showJoin} origin={origin} code={code} />
        ) : null}

        <div className="stage-canvas relative min-w-0 flex-1">
          {children}
          {nav ? <div className="absolute bottom-[3cqh] right-[3cqw] z-20">{nav}</div> : null}
        </div>
      </div>

      {overlay}
    </div>
  );
}

/**
 * Where the room is, and where it can go.
 *
 * Live these are pressed on the facilitator's console or a clicker, so on a
 * screen nobody can touch they are an affordance rather than a control — unless
 * the projector happens to be open on the facilitator's own machine, in which
 * case they are real buttons and the arrow keys work too.
 */
export function StageNav({
  onBack,
  onNext,
  canBack,
  canNext,
  interactive,
}: {
  onBack: () => void;
  onNext: () => void;
  canBack: boolean;
  canNext: boolean;
  interactive: boolean;
}) {
  const base =
    "flex h-[5cqh] min-h-8 w-[5cqh] min-w-8 items-center justify-center rounded-full text-[length:var(--text-stage-sm)] leading-none transition-colors";

  if (!interactive) {
    return (
      <div aria-hidden="true" className="flex items-center gap-[1cqw] text-ink-3/45">
        <span className={base}>←</span>
        <span className={base}>→</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[1cqw]">
      <button
        type="button"
        onClick={onBack}
        disabled={!canBack}
        aria-label="Previous"
        className={cn(base, "text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-30")}
      >
        ←
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next"
        className={cn(base, "text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-30")}
      >
        →
      </button>
    </div>
  );
}
