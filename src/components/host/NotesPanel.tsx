"use client";

import type { FacilitatorNote } from "@/lib/content/activity";

/**
 * The facilitator's private notes.
 *
 * These never reach the public state — they live in the content module, which
 * the projector imports for its stage list but never renders from. The banner
 * is there so a facilitator screen-sharing by accident knows immediately what
 * they are showing.
 */
export function NotesPanel({ note }: { note: FacilitatorNote }) {
  const items: { label: string; value: string | undefined }[] = [
    { label: "Ask", value: note.ask },
    { label: "Probe", value: note.probe },
    { label: "Learning", value: note.learning },
  ];

  return (
    <div className="rounded-xl border border-signal/35 bg-signal-wash p-4">
      <div className="eyebrow text-signal">Private facilitator note</div>

      <dl className="mt-3 space-y-3">
        {items
          .filter((i) => i.value)
          .map((item) => (
            <div key={item.label}>
              <dt className="eyebrow text-ink-3">{item.label}</dt>
              <dd className="mt-0.5 text-[0.95rem] leading-snug text-ink">{item.value}</dd>
            </div>
          ))}
      </dl>

      {note.talkingPoint ? (
        <div className="mt-4 border-t border-signal/25 pt-3">
          <div className="eyebrow text-ink-3">Talking point · 30–60s</div>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-2">{note.talkingPoint}</p>
        </div>
      ) : null}
    </div>
  );
}
