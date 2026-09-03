"use client";

import { cn } from "@/lib/cn";
import { getQuestion, getRole } from "@/lib/content/activity";
import type { FacilitatorState } from "@/lib/types";

/**
 * The split, before the room sees it.
 *
 * Only the facilitator ever gets this — the public state withholds results
 * until reveal — and it is here so they can decide how to frame what is about
 * to go on the wall, not so they can decide whether to show it honestly.
 */
export function ResultPreview({ state }: { state: FacilitatorState }) {
  const question = getQuestion(state.stage?.questionId);
  const preview = state.preview;
  if (!question || !preview) return null;

  const role = getRole(question.roleId);
  const revealed = state.phase === "revealed";

  return (
    <div className="rounded-xl border border-rule bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <div className="eyebrow text-ink-3">
          {revealed ? "On the projector" : "Not on the projector yet"}
        </div>
        <div className="text-xs text-ink-3 tnum">{preview.totalResponses} votes</div>
      </div>

      <div className="mt-3 space-y-2">
        {preview.options.map((option) => {
          const isTrain = option.optionId.endsWith(":train");
          const isFire = option.optionId.endsWith(":fire");
          const leading = option.optionId === preview.leadingOptionId;
          return (
            <div key={option.optionId} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-40 shrink-0 truncate text-sm font-semibold",
                  isTrain && "text-train",
                  isFire && "text-fire",
                  leading && !isTrain && !isFire && "text-ink",
                  !leading && !isTrain && !isFire && "text-ink-2",
                )}
              >
                {role && isTrain ? "Train" : role && isFire ? "Fire" : option.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    isTrain ? "bg-train" : isFire ? "bg-fire" : "bg-graphite",
                  )}
                  style={{ width: `${option.pct}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-ink-3 tnum">
                {Math.round(option.pct)}% · {option.count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-ink-3 tnum">
        Room {preview.roomResponses} · Online {preview.onlineResponses}
      </div>
    </div>
  );
}
