"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/ui/Wordmark";

/** Manual entry, for anyone who cannot scan the code from where they are sitting. */
export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const clean = code.replace(/\D/g, "").slice(0, 4);
  const ready = clean.length === 4;

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (ready) router.push(`/j/${clean}`);
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8 safe-bottom">
      <Wordmark />

      <form onSubmit={go} className="flex flex-1 flex-col justify-center">
        <label htmlFor="code" className="display text-[2.5rem] leading-none">
          Session code
        </label>
        <p className="mt-3 text-ink-2">Four digits, shown on the screen.</p>

        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={4}
          value={clean}
          onChange={(e) => setCode(e.target.value)}
          placeholder="0000"
          aria-describedby="code-hint"
          className="mt-7 w-full rounded-2xl border-2 border-rule bg-surface px-6 py-5 text-center font-mono text-[3.5rem] font-semibold tracking-[0.2em] tnum outline-none focus:border-ink"
        />

        <p id="code-hint" className="mt-3 text-sm text-ink-3">
          You&rsquo;ll choose whether you&rsquo;re in the room or online next.
        </p>

        <button
          type="submit"
          disabled={!ready}
          className="mt-7 h-16 w-full rounded-2xl bg-ink text-lg font-semibold text-paper transition-colors hover:bg-graphite disabled:opacity-40"
        >
          Join
        </button>
      </form>
    </main>
  );
}
