"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { isPubliclyReachable, joinUrl, useJoinOrigin } from "@/lib/client/app-url";
import { useStoredValue } from "@/lib/client/browser-state";
import { facilitatorKey, useFacilitator } from "@/lib/client/useSession";
import { cn } from "@/lib/cn";
import { getStage } from "@/lib/content/activity";
import type { ControlCommand, FacilitatorState } from "@/lib/types";
import { ResultPreview } from "./LiveStats";
import { NotesPanel } from "./NotesPanel";
import { StageList } from "./StageList";

/**
 * The console, reduced to what a facilitator actually touches while a room is
 * watching: Back, Reveal, Next.
 *
 * Everything else a session might need still exists, but it lives behind one
 * menu, because a control that is only needed when something has gone wrong
 * should not be competing for attention with the three that are needed every
 * ninety seconds.
 */
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
      <Header code={code} state={state} connection={api.connection} />

      {!state ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="eyebrow animate-breathe text-ink-3">
            {api.connection === "closed" ? "Session not found" : "Connecting"}
          </p>
        </div>
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 lg:flex-row">
            <section className="flex min-w-0 flex-1 flex-col gap-3">
              <OnScreen code={code} state={state} />
              <Warnings state={state} origin={origin} code={code} run={run} />
            </section>

            <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-95">
              <ResultPreview state={state} />
              <NotesPanel note={getStage(state.stageIndex)?.note ?? {}} />
            </aside>
          </main>

          <Transport state={state} run={run} busy={api.busy} origin={origin} code={code} />
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

function Header({
  code,
  state,
  connection,
}: {
  code: string;
  state: FacilitatorState | null;
  connection: Parameters<typeof ConnectionBadge>[0]["state"];
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule bg-surface px-6 py-3">
      <div className="flex items-baseline gap-4">
        <span className="display-loose text-base uppercase tracking-tight">
          Train <span className="text-ink-3">or</span> Fire
        </span>
        <span className="text-sm text-ink-3">
          Session <span className="font-mono font-semibold text-ink tnum">{code}</span>
        </span>
      </div>
      <div className="flex items-baseline gap-5 text-sm text-ink-2">
        {state ? (
          <>
            <span>
              <span className="font-semibold text-ink tnum">{state.counts.total}</span> joined
            </span>
            <span>
              <span className="font-semibold text-ink tnum">{state.counts.responses}</span>{" "}
              responded
            </span>
          </>
        ) : null}
        <ConnectionBadge state={connection} />
      </div>
    </header>
  );
}

/**
 * A live miniature of the projector.
 *
 * The console used to describe what was on screen in words. Showing the actual
 * thing removes a whole category of live mistake — the facilitator never has to
 * translate "stage 12, beat 4" into what the room is looking at.
 */
function OnScreen({ code, state }: { code: string; state: FacilitatorState }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);
  const W = 1600;
  const H = 900;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-ink-3">On the projector</span>
        <span className="text-xs text-ink-3 tnum">
          {state.stageIndex + 1} of {state.stageCount}
        </span>
      </div>
      <div
        ref={box}
        className="mt-2 flex min-h-60 flex-1 items-center justify-center overflow-hidden rounded-xl border border-rule bg-paper-2"
      >
        <iframe
          title="Projector preview"
          src={`/present/${code}`}
          width={W}
          height={H}
          // Pointer events off so a stray click cannot steal focus from the
          // controls; the preview is for looking at, not driving.
          className="pointer-events-none shrink-0 border-0 bg-paper"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        />
      </div>
    </div>
  );
}

/** The two things that make a session look broken from the floor. */
function Warnings({
  state,
  origin,
  code,
  run,
}: {
  state: FacilitatorState;
  origin: string;
  code: string;
  run: (c: ControlCommand) => void;
}) {
  const notLive = state.requiresParticipantResponse && state.status !== "live";
  const localOnly = origin && !isPubliclyReachable(origin);
  if (!notLive && !localOnly) return null;

  return (
    <div className="flex flex-col gap-2">
      {notLive ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl bg-fire-wash px-4 py-3"
        >
          <span className="text-sm font-semibold text-fire-deep">
            A decision is on screen but the session is {state.status} — phones cannot vote yet.
          </span>
          <button
            type="button"
            onClick={() => run({ type: state.status === "paused" ? "resume" : "start" })}
            className="rounded-lg bg-fire px-3 py-1.5 text-sm font-semibold text-white hover:bg-fire-deep"
          >
            {state.status === "paused" ? "Resume now" : "Start now"}
          </button>
        </div>
      ) : null}
      {localOnly ? (
        <div role="alert" className="rounded-xl bg-signal-wash px-4 py-3 text-sm text-ink">
          <span className="font-semibold text-signal">Local join link. </span>
          The QR points at <span className="font-mono">{joinUrl(origin, code)}</span> — reachable
          from this network only.
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transport — the only controls that matter live                      */
/* ------------------------------------------------------------------ */

function Transport({
  state,
  run,
  busy,
  origin,
  code,
}: {
  state: FacilitatorState;
  run: (c: ControlCommand) => void;
  busy: boolean;
  origin: string;
  code: string;
}) {
  const hasQuestion = state.requiresParticipantResponse;
  const open = hasQuestion && state.phase === "voting";
  const revealed = hasQuestion && state.phase === "revealed";
  const atStart = state.stageIndex === 0 && state.beat === 0;
  const atEnd =
    state.stageIndex === state.stageCount - 1 && state.beat === (state.stage?.beats ?? 1) - 1;

  return (
    <footer className="shrink-0 border-t border-rule bg-surface px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run({ type: "back" })}
          disabled={atStart || busy}
          className="h-14 rounded-xl border border-rule bg-surface px-6 text-base font-semibold text-ink transition-colors hover:bg-paper-2 disabled:opacity-35"
        >
          ← Back
        </button>

        {/*
         * Reveal is only a control when there is something to reveal. On every
         * other screen it would be a button that does nothing visible, which is
         * worse than no button at all.
         */}
        <button
          type="button"
          onClick={() => run({ type: "reveal" })}
          disabled={busy || !hasQuestion || revealed}
          className={cn(
            "h-14 rounded-xl px-7 text-base font-semibold transition-colors",
            hasQuestion && !revealed
              ? "bg-graphite text-paper hover:bg-ink"
              : "border border-rule bg-surface text-ink-3",
          )}
        >
          Reveal
        </button>

        <button
          type="button"
          onClick={() => run({ type: "next" })}
          disabled={atEnd || busy}
          className="h-14 min-w-36 rounded-xl bg-ink px-7 text-base font-semibold text-paper transition-colors hover:bg-graphite disabled:opacity-35"
        >
          Next →
        </button>

        <div className="ml-auto flex items-center gap-3">
          <VotingPill open={open} revealed={revealed} hasQuestion={hasQuestion} />
          <MoreMenu state={state} run={run} origin={origin} code={code} />
        </div>
      </div>

      <p className="mt-2.5 text-[0.72rem] text-ink-3">
        <Key>→</Key> next · <Key>←</Key> back · <Key>R</Key> reveal ·{" "}
        <span className="text-ink-3/70">
          Next reveals an open decision before it moves on, so a result is never skipped.
        </span>
      </p>
    </footer>
  );
}

function VotingPill({
  open,
  revealed,
  hasQuestion,
}: {
  open: boolean;
  revealed: boolean;
  hasQuestion: boolean;
}) {
  if (!hasQuestion) {
    return <span className="text-sm text-ink-3">No vote on this screen</span>;
  }
  return (
    <span className="text-sm text-ink-2">
      Voting{" "}
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
          open ? "bg-signal-wash text-signal" : revealed ? "bg-train-wash text-train" : "bg-paper-3 text-ink-2",
        )}
      >
        {open ? "Open" : revealed ? "Revealed" : "Locked"}
      </span>
    </span>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-rule bg-paper-2 px-1 font-mono text-[0.68rem] text-ink-2">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* Everything else                                                     */
/* ------------------------------------------------------------------ */

function MoreMenu({
  state,
  run,
  origin,
  code,
}: {
  state: FacilitatorState;
  run: (c: ControlCommand) => void;
  origin: string;
  code: string;
}) {
  const [open, setOpen] = useState(false);
  const [jump, setJump] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const close = () => {
    setOpen(false);
    setJump(false);
    setConfirmRestart(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl(origin, code));
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the link is on screen either way.
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label="More controls"
        className="h-11 rounded-xl border border-rule bg-surface px-4 text-lg leading-none text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
      >
        •••
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-40 w-80 overflow-hidden rounded-xl border border-rule bg-surface shadow-raise">
            {jump ? (
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                  <span className="eyebrow text-ink-3">Jump to section</span>
                  <button
                    type="button"
                    onClick={() => setJump(false)}
                    className="text-xs font-semibold text-ink-3 hover:text-ink"
                  >
                    Back
                  </button>
                </div>
                <StageList
                  state={state}
                  onJump={(stageIndex) => {
                    run({ type: "goto", stageIndex });
                    close();
                  }}
                />
              </div>
            ) : (
              <ul className="py-1.5">
                <Item
                  onClick={() => {
                    run({ type: state.overlay === "join" ? "hideJoin" : "showJoin" });
                    close();
                  }}
                >
                  {state.overlay === "join" ? "Hide full-screen QR" : "Show full-screen QR"}
                </Item>
                <Item onClick={copy}>
                  {copied ? "Link copied" : "Copy participant link"}
                </Item>
                <Item onClick={() => setJump(true)}>Jump to section…</Item>

                <Divider />

                {state.requiresParticipantResponse ? (
                  <Item
                    onClick={() => {
                      run({ type: state.phase === "voting" ? "lock" : "unlock" });
                      close();
                    }}
                  >
                    {state.phase === "voting" ? "Lock voting" : "Reopen voting"}
                  </Item>
                ) : null}
                <Item
                  onClick={() => {
                    run({ type: state.status === "live" ? "pause" : "start" });
                    close();
                  }}
                >
                  {state.status === "live" ? "Pause session" : "Start session"}
                </Item>

                <Divider />

                <Item onClick={() => { run({ type: "simulate", count: 30 }); close(); }}>
                  Add 30 simulated participants
                </Item>
                {state.simulatedCount > 0 ? (
                  <Item onClick={() => { run({ type: "clearSimulated" }); close(); }}>
                    Remove {state.simulatedCount} simulated
                  </Item>
                ) : null}

                <Divider />

                <Item
                  danger
                  onClick={() => {
                    if (!confirmRestart) return setConfirmRestart(true);
                    run({ type: "restart" });
                    close();
                  }}
                >
                  {confirmRestart ? "Confirm restart — clears every vote" : "Restart session"}
                </Item>
                <Item danger onClick={() => { run({ type: "end" }); close(); }}>
                  End session
                </Item>
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Item({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-paper-2",
          danger ? "text-fire hover:text-fire-deep" : "text-ink",
        )}
      >
        {children}
      </button>
    </li>
  );
}

const Divider = () => <li aria-hidden="true" className="my-1.5 h-px bg-rule-2" />;

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
