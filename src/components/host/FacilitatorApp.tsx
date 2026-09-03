"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Wordmark } from "@/components/ui/Wordmark";
import { isPubliclyReachable, joinUrl, useJoinOrigin } from "@/lib/client/app-url";
import { useStoredValue } from "@/lib/client/browser-state";
import { facilitatorKey, useFacilitator } from "@/lib/client/useSession";
import { cn } from "@/lib/cn";
import { getStage } from "@/lib/content/activity";
import type { ControlCommand, FacilitatorState } from "@/lib/types";
import { LiveStats, ResultPreview } from "./LiveStats";
import { NotesPanel } from "./NotesPanel";
import { StageList } from "./StageList";

export function FacilitatorApp({ code }: { code: string }) {
  const token = useStoredValue(facilitatorKey(code));
  const api = useFacilitator(code, token);
  const origin = useJoinOrigin();
  const { state, send } = api;

  const run = useCallback((command: ControlCommand) => void send(command), [send]);

  useKeyboardControls(run, Boolean(state));

  if (!token) return <NoToken code={code} />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-rule bg-surface px-6 py-3">
        <div className="flex items-baseline gap-4">
          <Wordmark />
          <span className="font-mono text-lg font-semibold tracking-tight tnum">{code}</span>
          <ConnectionBadge state={api.connection} />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/present/${code}`}
            target="_blank"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            Open projector ↗
          </Link>
          {origin ? (
            <span className="hidden font-mono text-xs text-ink-3 lg:inline">
              {joinUrl(origin, code).replace(/^https?:\/\//, "")}
            </span>
          ) : null}
        </div>
      </header>

      {!state ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="eyebrow animate-breathe text-ink-3">
            {api.connection === "closed" ? "Session not found" : "Connecting"}
          </p>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <section className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
              <StageHeader state={state} />
              {/*
               * A QR nobody outside this machine can open scans perfectly and
               * fails silently. The facilitator is the only person who can tell
               * whether a LAN address is fine (one room, one wifi) or fatal
               * (anyone dialling in), so say what the code points at and let
               * them judge.
               */}
              {origin && !isPubliclyReachable(origin) ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl bg-signal-wash px-4 py-3 text-sm text-ink"
                >
                  <span className="font-semibold text-signal">Local join link. </span>
                  The QR points at{" "}
                  <span className="font-mono">{joinUrl(origin, code)}</span> — reachable from this
                  network only. Anyone joining online will not be able to open it.
                </div>
              ) : null}
              {/*
               * The one mistake that reads as broken from the floor: a decision
               * on the projector that no phone will accept, because the session
               * was never started. Say so, and put the fix in the same line.
               */}
              {state.stage?.questionId && state.status !== "live" ? (
                <div
                  role="alert"
                  className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-fire-wash px-4 py-3"
                >
                  <span className="text-sm font-semibold text-fire-deep">
                    This decision is on screen but the session is {state.status} — phones cannot
                    vote yet.
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      run({ type: state.status === "paused" ? "resume" : "start" })
                    }
                  >
                    {state.status === "paused" ? "Resume now" : "Start now"}
                  </Button>
                </div>
              ) : null}
              <div className="mt-4">
                <LiveStats state={state} />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <NotesPanel note={getStage(state.stageIndex)?.note ?? {}} />
                <ResultPreview state={state} />
              </div>
              <SessionTools state={state} run={run} />
            </section>

            <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-rule bg-surface lg:block">
              <StageList
                state={state}
                onJump={(stageIndex) => run({ type: "goto", stageIndex })}
              />
            </aside>
          </div>

          <Transport state={state} run={run} busy={api.busy} />
        </>
      )}

      {api.error ? (
        <div role="alert" className="shrink-0 bg-fire px-6 py-2 text-sm font-semibold text-white">
          {api.error}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NoToken({ code }: { code: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="display text-3xl">This device isn&rsquo;t the facilitator.</h1>
      <p className="mt-3 max-w-md text-ink-2">
        The control token for session {code} is stored only on the device that created it — it is
        never put in a link. Start the session again from this device, or use the one you set it up
        on.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-graphite"
      >
        Start a new session
      </Link>
    </div>
  );
}

function StageHeader({ state }: { state: FacilitatorState }) {
  const stage = state.stage;
  const beats = stage?.beats ?? 1;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow text-ink-3">
          {stage?.chapter} · Stage {state.stageIndex + 1} of {state.stageCount}
        </div>
        <h1 className="display mt-1 text-3xl">{stage?.label ?? "—"}</h1>
      </div>

      <div className="flex items-center gap-2">
        {beats > 1 ? (
          <Pill tone="neutral">
            Beat {state.beat + 1}/{beats}
          </Pill>
        ) : null}
        {stage?.questionId ? (
          <Pill
            tone={
              state.phase === "voting" ? "open" : state.phase === "revealed" ? "revealed" : "locked"
            }
          >
            {state.phase === "voting"
              ? "Voting open"
              : state.phase === "revealed"
                ? "Revealed"
                : "Locked"}
          </Pill>
        ) : null}
        <Pill tone={state.status === "live" ? "open" : "neutral"}>{state.status}</Pill>
        {state.overlay === "join" ? <Pill tone="locked">QR overlay up</Pill> : null}
        {state.simulatedCount > 0 ? (
          <Pill tone="locked">{state.simulatedCount} simulated</Pill>
        ) : null}
      </div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "open" | "locked" | "revealed";
}) {
  const tones = {
    neutral: "bg-paper-2 text-ink-2",
    open: "bg-signal-wash text-signal",
    locked: "bg-paper-3 text-ink-2",
    revealed: "bg-train-wash text-train",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

function Transport({
  state,
  run,
  busy,
}: {
  state: FacilitatorState;
  run: (c: ControlCommand) => void;
  busy: boolean;
}) {
  const hasQuestion = Boolean(state.stage?.questionId);
  const atStart = state.stageIndex === 0 && state.beat === 0;
  const atEnd =
    state.stageIndex === state.stageCount - 1 && state.beat === (state.stage?.beats ?? 1) - 1;

  return (
    <footer className="shrink-0 border-t border-rule bg-surface px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run({ type: "back" })} disabled={atStart || busy} size="lg">
          ← Back
        </Button>
        <Button
          variant="solid"
          size="lg"
          onClick={() => run({ type: "next" })}
          disabled={atEnd || busy}
          className="min-w-32"
        >
          Next →
        </Button>

        <div className="mx-2 h-8 w-px bg-rule" />

        <Button
          variant={state.phase === "revealed" ? "outline" : "solid"}
          size="lg"
          onClick={() => run({ type: "reveal" })}
          disabled={busy}
          className={cn(!hasQuestion && "opacity-80")}
        >
          Reveal
        </Button>
        {hasQuestion ? (
          state.phase === "voting" ? (
            <Button onClick={() => run({ type: "lock" })} disabled={busy}>
              Lock voting
            </Button>
          ) : (
            <Button onClick={() => run({ type: "unlock" })} disabled={busy}>
              Unlock voting
            </Button>
          )
        ) : null}

        <div className="mx-2 h-8 w-px bg-rule" />

        {state.overlay === "join" ? (
          <Button onClick={() => run({ type: "hideJoin" })} disabled={busy}>
            Hide join QR
          </Button>
        ) : (
          <Button onClick={() => run({ type: "showJoin" })} disabled={busy}>
            Show join QR
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {state.status !== "live" ? (
            <Button
              variant="solid"
              onClick={() => run({ type: state.status === "paused" ? "resume" : "start" })}
              disabled={busy}
            >
              {state.status === "paused" ? "Resume" : "Start session"}
            </Button>
          ) : (
            <Button onClick={() => run({ type: "pause" })} disabled={busy}>
              Pause
            </Button>
          )}
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-ink-3">
        Keys: <Key>→</Key> next · <Key>←</Key> back · <Key>R</Key> reveal · <Key>L</Key> lock ·{" "}
        <Key>Q</Key> join QR
      </p>
    </footer>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-rule bg-paper-2 px-1 font-mono text-[0.65rem] text-ink-2">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* Session tools                                                       */
/* ------------------------------------------------------------------ */

function SessionTools({
  state,
  run,
}: {
  state: FacilitatorState;
  run: (c: ControlCommand) => void;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (!confirmRestart) return;
    const timer = setTimeout(() => setConfirmRestart(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmRestart]);

  return (
    <section className="mt-4 rounded-xl border border-rule bg-surface p-4">
      <div className="eyebrow text-ink-3">Session</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => run({ type: "settings", patch: { showQr: !state.settings.showQr } })}
        >
          Corner QR: {state.settings.showQr ? "on" : "off"}
        </Button>
        <Button
          size="sm"
          onClick={() =>
            run({ type: "settings", patch: { soundEnabled: !state.settings.soundEnabled } })
          }
        >
          Sound: {state.settings.soundEnabled ? "on" : "muted"}
        </Button>

        <div className="mx-1 h-6 w-px bg-rule" />

        <Button
          size="sm"
          onClick={() => run({ type: "resetStage" })}
          disabled={!state.stage?.questionId}
        >
          Clear this stage&rsquo;s votes
        </Button>
        <Button size="sm" onClick={() => run({ type: "simulate", count: 30 })}>
          Add 30 simulated
        </Button>
        {state.simulatedCount > 0 ? (
          <Button size="sm" onClick={() => run({ type: "clearSimulated" })}>
            Remove simulated
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {confirmRestart ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                run({ type: "restart" });
                setConfirmRestart(false);
              }}
            >
              Confirm restart — clears every vote
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRestart(true)}>
              Restart activity
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */

/**
 * A facilitator running a room has one hand on a clicker and their eyes on the
 * audience. Arrow keys map to what a presentation remote sends, so the whole
 * activity can be driven without looking at the console.
 */
function useKeyboardControls(run: (c: ControlCommand) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          run({ type: "next" });
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          run({ type: "back" });
          break;
        case "r":
        case "R":
          run({ type: "reveal" });
          break;
        case "l":
        case "L":
          run({ type: "lock" });
          break;
        case "u":
        case "U":
          run({ type: "unlock" });
          break;
        case "q":
        case "Q":
          run({ type: "showJoin" });
          break;
        case "Escape":
          run({ type: "hideJoin" });
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, enabled]);
}
