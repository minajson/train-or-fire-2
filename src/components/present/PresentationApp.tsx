"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { useJoinOrigin } from "@/lib/client/app-url";
import { useSessionStream } from "@/lib/client/useSession";
import { CHAIN, CHAIN_QUESTION_ID, getRole } from "@/lib/content/activity";
import { SoundProvider, useSound } from "@/lib/sound/SoundProvider";
import type { PublicSessionState } from "@/lib/types";
import { ChainQuestionStage, RewindStage, SystemStage } from "./RewindStages";
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
import { CornerJoin, JoinOverlay } from "./JoinPanel";
import { IncidentStage, JoinStage, OpeningStage, PreludeStage } from "./OpeningStages";
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

  if (!state) {
    return (
      <StageFrame className="flex items-center justify-center">
        <div className="stage-eyebrow animate-breathe text-ink-3">Connecting</div>
      </StageFrame>
    );
  }

  const stage = state.stage;

  /*
   * The corner code appears only while a decision is actually open. During a
   * reveal, the AAR, a learning screen or the close, it would be one more thing
   * competing with the single idea the screen is carrying — so it is not there.
   */
  const showCornerQr =
    state.settings.showQr &&
    Boolean(stage?.questionId) &&
    state.phase === "voting" &&
    state.overlay !== "join";

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {renderStage(state, origin)}

      <AnimatePresence>
        {showCornerQr ? <CornerJoin key="corner" origin={origin} code={code} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {state.overlay === "join" ? (
          <JoinOverlay key="overlay" origin={origin} code={code} />
        ) : null}
      </AnimatePresence>
    </div>
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
      return <TwistStage beat={state.beat} />;
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
