import Link from "next/link";
import { CreateSessionButton } from "@/components/home/CreateSessionButton";
import { Wordmark } from "@/components/ui/Wordmark";
import { ROLES } from "@/lib/content/activity";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-12">
      <header className="flex items-center justify-between">
        <Wordmark />
        <Link
          href="/join"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          Join a session
        </Link>
      </header>

      <div className="flex flex-1 flex-col justify-center py-14">
        <p className="eyebrow text-ink-3">The Warning Signs</p>

        <h1 className="display mt-5 text-[clamp(3rem,10vw,8rem)]">
          <span className="text-train">Train</span> <span className="text-ink-3">or</span>{" "}
          <span className="text-fire">Fire</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-2">
          One equipment failure. Four roles. The room decides who to keep and who to let go — and
          then finds out what that decision actually fixed.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <CreateSessionButton />
          <Link
            href="/join"
            className="inline-flex h-14 items-center justify-center rounded-lg border border-rule bg-surface px-6 text-base font-semibold text-ink transition-colors hover:bg-paper-2"
          >
            I have a session code
          </Link>
        </div>

        <p className="mt-6 max-w-2xl text-sm text-ink-3">
          Runs in the room and online at the same time. Participants join by scanning a code —
          nothing to install, no accounts, no personal names anywhere in the scenario.
        </p>
      </div>

      <section aria-label="The four roles" className="border-t border-rule pt-8">
        <p className="eyebrow text-ink-3">Four decisions</p>
        <ol className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <li key={role.id}>
              <div className="font-mono text-xs text-ink-3">{role.marker}</div>
              <div className="display-loose mt-1 text-lg">{role.title}</div>
              <p className="quote mt-1 text-sm text-ink-2">“{role.quote}”</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
