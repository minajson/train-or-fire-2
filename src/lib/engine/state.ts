import {
  clampBeat,
  getQuestion,
  getStage,
  STAGE_COUNT,
  STAGES,
  stageQuestion,
} from "@/lib/content/activity";
import type {
  FacilitatorState,
  Phase,
  PublicSessionState,
  SessionRecord,
  StageProgress,
} from "@/lib/types";
import { buildBoard } from "./board";
import { responseCount, revealedResults, tallyQuestion } from "./tally";

export function phaseOf(session: SessionRecord, questionId: string | null): Phase {
  if (!questionId) return "revealed";
  return session.phases[questionId] ?? "voting";
}

export function currentPhase(session: SessionRecord): Phase {
  const q = stageQuestion(session.stageIndex);
  return phaseOf(session, q?.id ?? null);
}

/**
 * A participant's own vote, echoed back to them alone. This is what makes a
 * mid-stage refresh survivable: the phone reconnects and their choice is
 * already selected.
 */
function buildOwnVote(
  session: SessionRecord,
  questionId: string | undefined,
  participantId: string | undefined,
): PublicSessionState["you"] {
  if (!questionId || !participantId) return null;
  const mine = session.responses.find(
    (r) => r.questionId === questionId && r.participantId === participantId,
  );
  return mine ? { answered: true, optionId: mine.optionId } : { answered: false, optionId: null };
}

export function buildPublicState(
  session: SessionRecord,
  opts: { participantId?: string } = {},
): PublicSessionState {
  const stage = getStage(session.stageIndex);
  const question = stageQuestion(session.stageIndex);
  const phase = phaseOf(session, question?.id ?? null);
  const participants = session.participants;

  return {
    code: session.code,
    title: session.title,
    status: session.status,
    stageIndex: session.stageIndex,
    stageCount: STAGE_COUNT,
    stage,
    beat: clampBeat(session.stageIndex, session.beat),
    phase,
    // A stage carries a question or it does not; there is no third case, and
    // no per-screen exceptions.
    requiresParticipantResponse: Boolean(question),
    overlay: session.overlay ?? null,
    counts: {
      total: participants.length,
      room: participants.filter((p) => p.mode === "room").length,
      online: participants.filter((p) => p.mode === "online").length,
      responses: question ? responseCount(session, question.id) : 0,
    },
    settings: { ...session.settings },
    /*
     * The single most important withholding in the app: until the facilitator
     * reveals, no screen — projector or phone — receives the split. The
     * projector can show "24 / 31 decided" because that comes from `counts`,
     * which carries no information about which way anyone voted.
     */
    results: question && phase === "revealed" ? revealedResults(session, question) : null,
    board: buildBoard(session),
    you: buildOwnVote(session, question?.id, opts.participantId),
    serverTime: Date.now(),
    revision: session.revision ?? 0,
  };
}

export function buildFacilitatorState(session: SessionRecord): FacilitatorState {
  const base = buildPublicState(session);
  const question = stageQuestion(session.stageIndex);

  const progress: StageProgress[] = STAGES.map((stage, index) => {
    const q = getQuestion(stage.questionId);
    return {
      stageIndex: index,
      stageId: stage.id,
      label: stage.label,
      chapter: stage.chapter,
      questionId: q?.id ?? null,
      responses: q ? responseCount(session, q.id) : 0,
      phase: q ? phaseOf(session, q.id) : null,
    };
  });

  return {
    ...base,
    progress,
    simulatedCount: session.participants.filter((p) => p.simulated).length,
    // The facilitator alone can see the split before revealing it, so they can
    // decide how to frame what is about to go on the wall.
    preview: question ? tallyQuestion(session, question) : null,
  };
}
