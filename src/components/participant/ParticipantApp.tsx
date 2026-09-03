"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { Wordmark } from "@/components/ui/Wordmark";
import { useParticipant } from "@/lib/client/useSession";
import { cn } from "@/lib/cn";
import {
  getQuestion,
  getRole,
  verdictOptionId,
  type Question,
  type Verdict,
} from "@/lib/content/activity";
import { QUICK } from "@/lib/motion/primitives";
import { SoundProvider, useSound } from "@/lib/sound/SoundProvider";
import type { JoinMode, PublicSessionState } from "@/lib/types";

export function ParticipantApp({ code }: { code: string }) {
  const api = useParticipant(code);

  return (
    <SoundProvider enabled={api.state?.settings.soundEnabled ?? true}>
      <Shell api={api} code={code} />
    </SoundProvider>
  );
}

type Api = ReturnType<typeof useParticipant>;

function Shell({ api, code }: { api: Api; code: string }) {
  const { state, identity, ready, connection } = api;

  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 safe-top safe-bottom">
      <header className="flex shrink-0 items-center justify-between py-3">
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="eyebrow text-ink-3 tnum">{code}</span>
          <ConnectionBadge state={connection} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {!ready ? (
          <Centered>
            <p className="eyebrow animate-breathe text-ink-3">Connecting</p>
          </Centered>
        ) : !state ? (
          <Centered>
            <p className="display text-2xl">Session not found.</p>
            <p className="mt-2 text-sm text-ink-2">Check the code and try again.</p>
          </Centered>
        ) : !identity ? (
          <JoinScreen api={api} state={state} />
        ) : (
          <LiveScreen api={api} state={state} />
        )}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Join                                                                */
/* ------------------------------------------------------------------ */

function JoinScreen({ api, state }: { api: Api; state: PublicSessionState }) {
  const [busy, setBusy] = useState<JoinMode | null>(null);

  const join = async (mode: JoinMode) => {
    setBusy(mode);
    try {
      await api.join(mode);
    } catch {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="pt-6">
        <h1 className="display text-[2.6rem] leading-[0.9]">
          <span className="text-train">Train</span> <span className="text-ink-3">or</span>{" "}
          <span className="text-fire">Fire</span>
        </h1>
        <p className="mt-3 text-[0.95rem] text-ink-2">Where are you joining from?</p>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-3 pb-6">
        <ModeButton
          label="In the room"
          hint="You're here in person"
          onClick={() => join("room")}
          busy={busy === "room"}
          disabled={api.joining}
        />
        <ModeButton
          label="Online"
          hint="You're joining remotely"
          onClick={() => join("online")}
          busy={busy === "online"}
          disabled={api.joining}
        />
      </div>

      {api.error ? <p className="pb-4 text-sm text-fire">{api.error}</p> : null}
      <p className="pb-4 text-center text-xs text-ink-3">
        {state.counts.total} already joined
      </p>
    </div>
  );
}

function ModeButton({
  label,
  hint,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 flex-col items-start justify-center rounded-2xl border-2 border-rule bg-surface px-6 py-8",
        "text-left transition-colors active:bg-paper-2 disabled:opacity-60",
        busy && "border-ink",
      )}
    >
      <span className="display text-[2rem] leading-none">{label}</span>
      <span className="mt-2 text-sm text-ink-3">{hint}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Live                                                                */
/* ------------------------------------------------------------------ */

function LiveScreen({ api, state }: { api: Api; state: PublicSessionState }) {
  const question = getQuestion(state.stage?.questionId);

  if (!question) return <WaitingScreen state={state} />;
  if (state.status !== "live") return <WaitingScreen state={state} />;

  if (state.phase !== "voting") {
    return <LockedScreen state={state} question={question} />;
  }

  return question.kind === "verdict" ? (
    <VerdictScreen api={api} state={state} question={question} />
  ) : (
    <ChoiceScreen api={api} state={state} question={question} />
  );
}

/** What the phone says while the projector is carrying the session. */
function waitingCopy(state: PublicSessionState): { title: string; body: string } {
  if (state.status === "lobby") {
    return { title: "You're in.", body: "Look up — we'll start in a moment." };
  }
  if (state.status === "paused") {
    return { title: "Paused.", body: "We'll pick this up shortly." };
  }
  if (state.status === "ended") {
    return { title: "That's the session.", body: "Thanks for deciding with us." };
  }

  if (state.stage?.kind === "closing") {
    return { title: "Thank you.", body: "What will you do before the next warning?" };
  }

  /*
   * One message for every screen the room cannot answer.
   *
   * A phone that keeps changing its mind about what it is telling you pulls
   * eyes down at exactly the moments the projector is carrying the session.
   * This says the two things a participant needs — you are in, and you will be
   * told — and then stays still.
   */
  return {
    title: "You're in.",
    body: "Follow the discussion on screen. We'll let you know when the next decision opens.",
  };
}

function WaitingScreen({ state }: { state: PublicSessionState }) {
  const copy = waitingCopy(state);
  return (
    <Centered>
      <motion.div
        key={copy.title}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={QUICK}
      >
        <p className="display text-[2.4rem] leading-[0.95]">{copy.title}</p>
        <p className="mt-3 text-[1rem] text-ink-2">{copy.body}</p>
      </motion.div>
    </Centered>
  );
}

/* ------------------------------------------------------------------ */
/* The TRAIN / FIRE decision                                           */
/* ------------------------------------------------------------------ */

function VerdictScreen({
  api,
  state,
  question,
}: {
  api: Api;
  state: PublicSessionState;
  question: Question;
}) {
  const role = getRole(question.roleId);
  const chosen = state.you?.optionId ?? null;
  const { play } = useSound();

  /*
   * Optimistic selection.
   *
   * A tap has to look answered before the round trip completes, or a room on
   * conference wifi taps twice. `pending` holds that guess; the moment the
   * server's own answer changes — including to null, when the facilitator
   * clears the stage — the guess is dropped. Adjusting state during render is
   * React's sanctioned pattern for this; an effect here would cost a second
   * render pass on every single vote.
   */
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(chosen);
  if (seen !== chosen) {
    setSeen(chosen);
    setPending(null);
  }

  const pick = useCallback(
    async (verdict: Verdict) => {
      const optionId = verdictOptionId(question.id, verdict);
      setPending(optionId);
      play(verdict === "train" ? "train" : "fire");
      try {
        await api.vote(question.id, optionId);
      } catch {
        setPending(null);
      }
    },
    [api, question.id, play],
  );

  if (!role) return <WaitingScreen state={state} />;

  const active = pending ?? chosen;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      <div className="shrink-0 pt-1">
        <div className="eyebrow text-ink-3">{role.marker}</div>
        <h1 className="display mt-1.5 text-[2rem] leading-[0.95]">{role.title}</h1>
        <ul className="mt-2.5 space-y-0.5">
          {role.phoneFacts.map((fact) => (
            <li key={fact} className="text-[0.9rem] leading-snug text-ink-2">
              {fact}
            </li>
          ))}
        </ul>
        <p className="quote mt-2.5 text-[1.05rem] text-ink">“{role.quote}”</p>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <VerdictButton
          verdict="train"
          selected={active === verdictOptionId(question.id, "train")}
          onClick={() => pick("train")}
        />
        <VerdictButton
          verdict="fire"
          selected={active === verdictOptionId(question.id, "fire")}
          onClick={() => pick("fire")}
        />
      </div>

      <p className="shrink-0 pt-3 text-center text-xs text-ink-3">
        {active ? "Tap the other one to change your mind." : "One tap. You can change it."}
      </p>
      {api.error ? <p className="pt-1 text-center text-xs text-fire">{api.error}</p> : null}
    </div>
  );
}

const VERDICT_STYLE: Record<
  Verdict,
  { label: string; on: string; off: string }
> = {
  train: {
    label: "Train",
    on: "bg-train text-white border-train",
    off: "bg-train-wash text-train border-train-edge",
  },
  fire: {
    label: "Fire",
    on: "bg-fire text-white border-fire",
    off: "bg-fire-wash text-fire border-fire-edge",
  },
};

/**
 * The one control that matters, at the size it deserves.
 *
 * Selection is never carried by colour alone: the chosen side gains the solid
 * fill, a filled mark, and the word "Chosen" underneath. Someone who cannot
 * tell the green from the red can still tell which one they picked.
 */
function VerdictButton({
  verdict,
  selected,
  onClick,
}: {
  verdict: Verdict;
  selected: boolean;
  onClick: () => void;
}) {
  const style = VERDICT_STYLE[verdict];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-[6.5rem] flex-1 items-center justify-between gap-4 rounded-2xl border-2 px-6",
        "transition-colors duration-150 active:scale-[0.995]",
        selected ? style.on : style.off,
      )}
    >
      <span className="display text-[2.6rem] uppercase leading-none">{style.label}</span>
      <span className="flex flex-col items-center gap-1">
        <VerdictMark verdict={verdict} className="h-9 w-9" strokeWidth={2.8} />
        <AnimatePresence>
          {selected ? (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="eyebrow"
            >
              Chosen
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Single-choice questions (the chain, and what failed first)          */
/* ------------------------------------------------------------------ */

function ChoiceScreen({
  api,
  state,
  question,
}: {
  api: Api;
  state: PublicSessionState;
  question: Question;
}) {
  const chosen = state.you?.optionId ?? null;
  const { play } = useSound();

  // Same optimistic-selection pattern as the verdict screen above.
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(chosen);
  if (seen !== chosen) {
    setSeen(chosen);
    setPending(null);
  }

  const pick = async (optionId: string) => {
    setPending(optionId);
    play("tap");
    try {
      await api.vote(question.id, optionId);
    } catch {
      setPending(null);
    }
  };

  const active = pending ?? chosen;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      <h1 className="display shrink-0 pt-1 text-[1.75rem] leading-[1]">
        {question.participantPrompt ?? question.prompt}
      </h1>

      <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-2">
        {question.options.map((option, i) => {
          const selected = active === option.id;
          return (
            <li key={option.id} className="flex min-h-0 flex-1">
              <button
                type="button"
                onClick={() => pick(option.id)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full min-h-[3rem] items-center gap-3 rounded-xl border-2 px-4 text-left",
                  "transition-colors duration-150",
                  selected
                    ? "border-ink bg-ink text-paper"
                    : "border-rule bg-surface text-ink active:bg-paper-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold tnum",
                    selected ? "bg-paper text-ink" : "bg-paper-2 text-ink-3",
                  )}
                >
                  {option.chainN ?? i + 1}
                </span>
                <span className="display-loose text-[1.05rem] leading-tight">{option.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="shrink-0 pt-3 text-center text-xs text-ink-3">
        {active ? "You can change your answer." : "Choose one."}
      </p>
      {api.error ? <p className="pt-1 text-center text-xs text-fire">{api.error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Locked                                                              */
/* ------------------------------------------------------------------ */

function LockedScreen({
  state,
  question,
}: {
  state: PublicSessionState;
  question: Question;
}) {
  const chosen = state.you?.optionId ?? null;
  const option = question.options.find((o) => o.id === chosen);
  const verdict: Verdict | null =
    question.kind === "verdict" && chosen ? (chosen.endsWith(":fire") ? "fire" : "train") : null;

  return (
    <Centered>
      <div>
        <p className="eyebrow text-ink-3">Decision locked</p>
        {option ? (
          <p
            className={cn(
              "display mt-3 text-[3rem] uppercase leading-none",
              verdict === "train" && "text-train",
              verdict === "fire" && "text-fire",
            )}
          >
            {verdict ? (
              <span className="inline-flex items-center gap-3">
                <VerdictMark verdict={verdict} className="h-10 w-10" strokeWidth={2.8} />
                {option.label}
              </span>
            ) : (
              <span className="text-[2rem] normal-case">{option.label}</span>
            )}
          </p>
        ) : (
          <p className="display mt-3 text-[2.2rem] leading-none text-ink-3">No vote recorded</p>
        )}
        <p className="mt-5 text-[1rem] text-ink-2">Waiting for the room…</p>
      </div>
    </Centered>
  );
}
