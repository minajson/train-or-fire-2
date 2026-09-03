"use client";

import { cn } from "@/lib/cn";
import { CHAPTERS } from "@/lib/content/activity";
import type { FacilitatorState, Phase } from "@/lib/types";

const PHASE_LABEL: Record<Phase, string> = {
  voting: "Open",
  locked: "Locked",
  revealed: "Revealed",
};

const PHASE_TONE: Record<Phase, string> = {
  voting: "bg-signal-wash text-signal",
  locked: "bg-paper-2 text-ink-3",
  revealed: "bg-train-wash text-train",
};

/** Jump to any stage. The facilitator's map of the whole activity. */
export function StageList({
  state,
  onJump,
}: {
  state: FacilitatorState;
  onJump: (stageIndex: number) => void;
}) {
  return (
    <nav aria-label="Stages" className="pb-6">
      {CHAPTERS.map((chapter) => {
        const rows = state.progress.filter((p) => p.chapter === chapter);
        if (rows.length === 0) return null;
        return (
          <div key={chapter} className="mt-5 first:mt-3">
            <div className="eyebrow px-4 text-ink-3">{chapter}</div>
            <ul className="mt-1.5">
              {rows.map((row) => {
                const current = row.stageIndex === state.stageIndex;
                return (
                  <li key={row.stageId}>
                    <button
                      type="button"
                      onClick={() => onJump(row.stageIndex)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-2 text-left transition-colors",
                        current ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                      )}
                    >
                      <span
                        className={cn(
                          "w-6 shrink-0 font-mono text-[0.68rem] tnum",
                          current ? "text-paper/70" : "text-ink-3",
                        )}
                      >
                        {String(row.stageIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.86rem] font-medium">
                        {row.label}
                      </span>
                      {row.phase ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide",
                            current ? "bg-paper/15 text-paper" : PHASE_TONE[row.phase],
                          )}
                        >
                          {row.responses > 0 ? `${row.responses} · ` : ""}
                          {PHASE_LABEL[row.phase]}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
