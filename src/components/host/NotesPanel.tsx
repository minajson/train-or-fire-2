"use client";

import type { FacilitatorNote } from "@/lib/content/activity";

/**
 * The facilitator's private notes.
 *
 * Visible but secondary. These are read between decisions, not during them, so
 * they sit quietly beside the controls rather than shouting from a coloured
 * panel — the loud thing on this screen should be Back / Reveal / Next.
 *
 * Never reaches the public state: these live in the content module, which the
 * projector imports for its stage list but never renders from.
 */
export function NotesPanel({ note }: { note: FacilitatorNote }) {
  const items: { label: string; value: string | undefined }[] = [
    { label: "Ask", value: note.ask },
    { label: "Probe", value: note.probe },
    { label: "Learning", value: note.learning },
  ].filter((i) => i.value);

  if (items.length === 0 && !note.talkingPoint) return null;

  return (
    <section className="rounded-xl border border-rule bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow text-ink-3">Discussion</h2>
        <span className="text-[0.65rem] uppercase tracking-wide text-ink-3">Private</span>
      </div>

      <dl className="mt-3 space-y-3 border-l-2 border-rule pl-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="eyebrow text-ink-3">{item.label}</dt>
            <dd className="mt-0.5 text-[0.92rem] leading-snug text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>

      {note.talkingPoint ? (
        <details className="mt-3 border-t border-rule-2 pt-3">
          <summary className="eyebrow cursor-pointer text-ink-3 hover:text-ink">
            Talking point · 30–60s
          </summary>
          <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-2">{note.talkingPoint}</p>
        </details>
      ) : null}
    </section>
  );
}
