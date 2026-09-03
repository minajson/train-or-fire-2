"use client";

import type { FacilitatorNote } from "@/lib/content/activity";

/**
 * The facilitator's private notes.
 *
 * Three things only: what to ask, what to push on, and what the stage is for.
 * These get read in the gap between decisions with a room waiting, so the whole
 * panel has to be scannable in a couple of seconds — which is why the prepared
 * talking point is gone. It was the one item here nobody could take in at a
 * glance, and its space is worth more given to the three that can be.
 *
 * Never reaches the public state: these live in the content module, which the
 * projector imports for its stage list but never renders from.
 */
export function NotesPanel({ note }: { note: FacilitatorNote }) {
  const items = [
    { label: "Ask", value: note.ask },
    { label: "Probe", value: note.probe },
    { label: "Learning", value: note.learning },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-rule bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow text-ink-3">Discussion</h2>
        <span className="text-[0.65rem] uppercase tracking-wide text-ink-3">Private</span>
      </div>

      <dl className="mt-4 space-y-4 border-l-2 border-rule pl-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="eyebrow text-ink-3">{item.label}</dt>
            <dd className="mt-1 text-[1.02rem] leading-relaxed text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
