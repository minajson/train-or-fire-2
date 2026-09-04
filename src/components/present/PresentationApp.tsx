"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import { useJoinOrigin } from "@/lib/client/app-url";
import { useStoredValue } from "@/lib/client/browser-state";
import { facilitatorKey, useSessionStream } from "@/lib/client/useSession";
import { CHAIN, CHAIN_QUESTION_ID, getRole } from "@/lib/content/activity";
import { SoundProvider, useSound } from "@/lib/sound/SoundProvider";
import type { ControlCommand, PublicSessionState } from "@/lib/types";
import {
  ClosingStage,
  CostClaimStage,
  CostRealityStage,
  FinalMachineStage,
  LearningStage,
  TruthStage,
} from "./ClosingStages";
import { DecisionStage } from "./DecisionStage";
import { FinalPollStage } from "./FinalPollStage";
import { JoinOverlay } from "./JoinPanel";
import { IncidentStage, JoinStage, OpeningStage, PreludeStage } from "./OpeningStages";
import { ProjectorShell, StageNav } from "./ProjectorShell";
import { ChainQuestionStage, RewindStage, SystemStage } from "./RewindStages";
import { StageFrame } from "./StageFrame";
import { TwistStage, VerdictStage } from "./VerdictStage";

export function PresentationApp({ code }: { code: string }) {
  const { state } = useSessionStream(code);

  return (
    <SoundProvider enabled={state?.settings.soundEnabled ?? true}>
      <Projector code={code} state={state} />
    </SoundProvider>
  );
}

function Projector({ code, state }: { code: string; state: PublicSessionState | null }) {
  const origin = useJoinOrigin();
  useProjectorSound(state);

  /*
   * The projector is usually a second window on the facilitator's own laptop.
   * When it is, the token for this session is already in local storage and the
   * arrows become real controls — one less device to reach for. On a machine
   * that is only ever a display they stay quiet affordances.
   */
  const token = useStoredValue(facilitatorKey(code));
  const send = useCallback(
    (command: ControlCommand) => {
      if (!token) return;
      void fetch(`/api/sessions/${encodeURIComponent(code)}/control`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-facilitator-token": token },
        body: JSON.stringify({ command }),
      }).catch(() => {});
    },
    [code, token],
  );

  useEffect(() => {
    if (!token) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        send({ type: "next" });
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        send({ type: "back" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [token, send]);

  if (!state) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper">
        <div className="stage-eyebrow animate-breathe text-ink-3">Connecting</div>
      </div>
    );
  }

  const stage = state.stage;
  const atStart = state.stageIndex === 0 && state.beat === 0;
  const atEnd = state.stageIndex === state.stageCount - 1 && state.beat === (stage?.beats ?? 1) - 1;

  return (
    <ProjectorShell
      panel={stage?.panel ?? "quiet"}
      /*
       * The one rule for the join code: if the room can answer what is on
       * screen, the code is up. No per-screen exceptions, and it does not go
       * away on reveal — a latecomer arriving mid-result still needs to be in
       * before the next decision opens.
       */
      showJoin={state.requiresParticipantResponse && state.settings.showQr}
      origin={origin}
      code={code}
      counts={state.counts}
      live={state.status === "live"}
      overlay={
        <AnimatePresence>
          {state.overlay === "join" ? (
            <JoinOverlay key="overlay" origin={origin} code={code} />
          ) : null}
        </AnimatePresence>
      }
      nav={
        <StageNav
          interactive={Boolean(token)}
          canBack={!atStart}
          canNext={!atEnd}
          onBack={() => send({ type: "back" })}
          onNext={() => send({ type: "next" })}
        />
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state.stageIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="h-full w-full"
        >
          {renderStage(state, origin)}
        </motion.div>
      </AnimatePresence>
    </ProjectorShell>
  );
}

function renderStage(state: PublicSessionState, origin: string) {
  const stage = state.stage;
  if (!stage) return <StageFrame />;

  switch (stage.kind) {
    case "opening":
      return <OpeningStage beat={state.beat} />;
    case "join":
      return <JoinStage state={state} origin={origin} />;
    case "incident":
      return <IncidentStage beat={state.beat} />;
    case "prelude":
      return <PreludeStage beat={state.beat} />;
    case "decision": {
      const role = getRole(stage.roleId);
      return role ? <DecisionStage state={state} role={role} /> : <StageFrame />;
    }
    case "verdict":
      return <VerdictStage state={state} />;
    case "twist":
      return <TwistStage beat={state.beat} board={state.board} />;
    case "rewind":
      return <RewindStage beat={state.beat} />;
    case "question":
      return stage.questionId === CHAIN_QUESTION_ID ? (
        <ChainQuestionStage state={state} />
      ) : (
        <FinalPollStage state={state} />
      );
    case "system":
      return <SystemStage beat={state.beat} />;
    case "learning":
      return <LearningStage index={stage.learningIndex ?? 0} beat={state.beat} />;
    case "cost-claim":
      return <CostClaimStage />;
    case "cost-reality":
      return <CostRealityStage beat={state.beat} />;
    case "final":
      return <FinalMachineStage beat={state.beat} />;
    case "truth":
      return <TruthStage beat={state.beat} />;
    case "closing":
      return <ClosingStage beat={state.beat} />;
    default:
      return <StageFrame />;
  }
}

/* ------------------------------------------------------------------ */
/* Sound                                                               */
/* ------------------------------------------------------------------ */

/**
 * Cues, driven off state transitions rather than off render.
 *
 * Sparingly, and never twice for the same event: everything here compares
 * against the previous frame, so a reconnect that replays the current state
 * cannot re-fire the failure sound in the middle of a discussion.
 */
function useProjectorSound(state: PublicSessionState | null) {
  const { play } = useSound();
  const previous = useRef<PublicSessionState | null>(null);

  useEffect(() => {
    const prev = previous.current;
    previous.current = state;
    if (!state) return;

    const stage = state.stage;
    if (!stage) return;

    // First frame after a page load: set the baseline, stay silent.
    if (!prev) return;

    const movedStage = prev.stageIndex !== state.stageIndex;
    const movedBeat = !movedStage && prev.beat !== state.beat;

    if (movedStage) play("advance");

    // A verdict opening: the weight of the decision, then the role settling.
    if (prev.phase !== "revealed" && state.phase === "revealed") {
      play("reveal");
      if (stage.kind === "decision" && stage.roleId) {
        const entry = state.board.find((b) => b.roleId === stage.roleId);
        if (entry) {
          window.setTimeout(() => play(entry.verdict === "train" ? "train" : "fire"), 420);
          window.setTimeout(() => play("settle"), 900);
        }
      }
    }

    // The chain reaching its last link is the machine failing.
    if (stage.kind === "rewind" && (movedBeat || movedStage) && state.beat === CHAIN.length - 1) {
      play("failure");
    }

    if (stage.kind === "twist" && movedBeat && state.beat === 1) play("reveal");
    if (stage.kind === "closing" && movedStage) play("closing");
    if (stage.kind === "cost-reality" && movedStage) play("reveal");
    if (movedBeat && stage.kind !== "rewind" && stage.kind !== "twist") play("advance");
  }, [state, play]);
}
