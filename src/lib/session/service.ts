import "server-only";
import {
  clampBeat,
  getQuestion,
  getStage,
  QUESTIONS,
  STAGE_COUNT,
  stageQuestion,
  type Question,
} from "@/lib/content/activity";
import { buildFacilitatorState, buildPublicState } from "@/lib/engine/state";
import { captureSnapshot } from "@/lib/engine/tally";
import { facilitatorToken, joinCode, participantSecret, safeEqual, uuid } from "@/lib/security/ids";
import { getStore, type SessionStore } from "@/lib/store";
import { CodeTakenError } from "@/lib/store/postgres";
import {
  DEFAULT_SETTINGS,
  type ControlCommand,
  type FacilitatorState,
  type JoinMode,
  type Participant,
  type Phase,
  type PublicSessionState,
  type SessionRecord,
  type SessionSettings,
} from "@/lib/types";
import { simulatedVote } from "./simulate";

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

const notFound = () => new SessionError("Session not found.", 404);

export const MAX_PARTICIPANTS = 1000;

export function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createSession(title?: string): Promise<SessionRecord> {
  const store = getStore();
  await store.init();

  /*
   * Four digits is 10k codes, so a collision with a live session is rare but
   * not impossible. Checking first is not enough on its own: two instances can
   * see the same code free in the same instant, so the insert itself is the
   * authority and a lost race just means picking another number.
   */
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = joinCode();
    if (await store.getByCode(candidate)) continue;
    try {
      return await insertSession(store, candidate, title);
    } catch (error) {
      if (error instanceof CodeTakenError) continue;
      throw error;
    }
  }
  throw new SessionError("Could not allocate a session code. Try again.", 503);
}

async function insertSession(
  store: SessionStore,
  code: string,
  title?: string,
): Promise<SessionRecord> {
  const now = Date.now();
  const record: SessionRecord = {
    id: uuid(),
    code,
    facilitatorToken: facilitatorToken(),
    title: (title ?? "Train or Fire").slice(0, 80),
    status: "lobby",
    stageIndex: 0,
    beat: 0,
    overlay: null,
    phases: {},
    snapshots: {},
    settings: { ...DEFAULT_SETTINGS },
    revision: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null,
    participants: [],
    responses: [],
  };

  await store.create(record);
  await store.publish(code);
  return record;
}

export async function getSession(code: string): Promise<SessionRecord> {
  const session = await getStore().getByCode(normalizeCode(code));
  if (!session) throw notFound();
  return session;
}

export async function getPublicState(
  code: string,
  participantId?: string,
): Promise<PublicSessionState> {
  return buildPublicState(await getSession(code), { participantId });
}

export async function getFacilitatorState(code: string, token: string): Promise<FacilitatorState> {
  const session = await getSession(code);
  assertFacilitator(session, token);
  return buildFacilitatorState(session);
}

export function assertFacilitator(session: SessionRecord, token: string | null | undefined) {
  if (!token || !safeEqual(session.facilitatorToken, token)) {
    throw new SessionError("Not authorised for this session.", 403);
  }
}

/* ------------------------------------------------------------------ */
/* Join / presence                                                     */
/* ------------------------------------------------------------------ */

export interface JoinResult {
  participantId: string;
  secret: string;
  mode: JoinMode;
  state: PublicSessionState;
}

export async function joinSession(
  code: string,
  mode: JoinMode,
  existing?: { participantId?: string | null; secret?: string | null },
): Promise<JoinResult> {
  const clean = normalizeCode(code);
  const result = await getStore().update(clean, (draft) => {
    if (draft.status === "ended") {
      throw new SessionError("This session has ended.", 410);
    }

    /*
     * Reconnect path. A refresh, a phone waking from sleep, or a participant
     * switching from Room to Online must not create a second participant or
     * orphan the votes already cast — the board would silently gain a phantom
     * abstainer and the percentages would drift.
     */
    if (existing?.participantId && existing.secret) {
      const found = draft.participants.find((p) => p.id === existing.participantId);
      if (found && safeEqual(found.secret, existing.secret)) {
        found.lastSeen = Date.now();
        found.mode = mode;
        for (const r of draft.responses) {
          if (r.participantId === found.id) r.mode = mode;
        }
        return { participant: found };
      }
    }

    if (draft.participants.length >= MAX_PARTICIPANTS) {
      throw new SessionError("This session is full.", 429);
    }

    const participant: Participant = {
      id: uuid(),
      mode,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      simulated: false,
      secret: participantSecret(),
    };
    draft.participants.push(participant);
    return { participant };
  });

  if (!result) throw notFound();
  return {
    participantId: result.value.participant.id,
    secret: result.value.participant.secret,
    mode: result.value.participant.mode,
    state: buildPublicState(result.session, { participantId: result.value.participant.id }),
  };
}

/** Presence ping. Cheap, and deliberately quiet. */
export async function heartbeat(code: string, participantId: string, secret: string) {
  await getStore().update(normalizeCode(code), (draft) => {
    const p = draft.participants.find((x) => x.id === participantId);
    if (!p || !safeEqual(p.secret, secret)) return false;
    p.lastSeen = Date.now();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Voting                                                              */
/* ------------------------------------------------------------------ */

function assertOpen(draft: SessionRecord, question: Question) {
  if (draft.status !== "live") {
    throw new SessionError("This session is not accepting votes right now.", 409);
  }
  const current = stageQuestion(draft.stageIndex);
  if (current?.id !== question.id) {
    throw new SessionError("That decision is no longer on screen.", 409);
  }
  const phase: Phase = draft.phases[question.id] ?? "voting";
  if (phase !== "voting") {
    throw new SessionError("Voting is closed for this decision.", 409);
  }
}

export async function submitVote(
  code: string,
  participantId: string,
  secret: string,
  questionId: string,
  optionId: string,
): Promise<PublicSessionState> {
  const question = getQuestion(questionId);
  if (!question) throw new SessionError("Unknown decision.", 404);
  if (!question.options.some((o) => o.id === optionId)) {
    throw new SessionError("Unknown option.", 422);
  }

  const result = await getStore().update(normalizeCode(code), (draft) => {
    const participant = draft.participants.find((p) => p.id === participantId);
    if (!participant || !safeEqual(participant.secret, secret)) {
      throw new SessionError("Rejoin to vote.", 401);
    }
    assertOpen(draft, question);
    participant.lastSeen = Date.now();

    const now = Date.now();
    const existing = draft.responses.find(
      (r) => r.questionId === questionId && r.participantId === participantId,
    );

    // Changing your mind is allowed right up until the facilitator locks or
    // reveals — that is the whole reason `assertOpen` runs first.
    if (existing) {
      existing.optionId = optionId;
      existing.mode = participant.mode;
      existing.updatedAt = now;
    } else {
      draft.responses.push({
        id: uuid(),
        questionId,
        participantId,
        mode: participant.mode,
        optionId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true };
  });

  if (!result) throw notFound();
  return buildPublicState(result.session, { participantId });
}

/* ------------------------------------------------------------------ */
/* Facilitator control                                                 */
/* ------------------------------------------------------------------ */

const clampStage = (n: number) => Math.max(0, Math.min(STAGE_COUNT - 1, Math.trunc(n) || 0));

/** Last beat of a stage — where Back lands, so a built chain returns built. */
const lastBeat = (index: number) => Math.max(0, (getStage(index)?.beats ?? 1) - 1);

/**
 * Moves a question into a phase, and keeps the result record honest while
 * doing it.
 *
 * Revealing FREEZES the count. Reopening voting DISCARDS the frozen count,
 * because a result the room can still change is not a result. Locking touches
 * neither — it closes the door without saying what is behind it.
 *
 * This is the whole guarantee the projector rests on: between a reveal and an
 * explicit reopen, the numbers on the wall cannot move.
 */
function revealQuestion(draft: SessionRecord, question: Question) {
  draft.phases[question.id] = "revealed";
  // Re-revealing something already revealed must not re-count it — votes can
  // arrive by another route, and the room has already seen a number.
  draft.snapshots ??= {};
  draft.snapshots[question.id] ??= captureSnapshot(draft, question);
}

function clearSnapshot(draft: SessionRecord, questionId: string) {
  if (draft.snapshots) delete draft.snapshots[questionId];
}

function setPhase(draft: SessionRecord, phase: Phase) {
  const q = stageQuestion(draft.stageIndex);
  if (!q) return false;
  if (phase === "revealed") {
    revealQuestion(draft, q);
    return true;
  }
  draft.phases[q.id] = phase;
  if (phase === "voting") clearSnapshot(draft, q.id);
  return true;
}

function sanitizeSettings(patch: Partial<SessionSettings>): Partial<SessionSettings> {
  const out: Partial<SessionSettings> = {};
  if (typeof patch.showQr === "boolean") out.showQr = patch.showQr;
  if (typeof patch.soundEnabled === "boolean") out.soundEnabled = patch.soundEnabled;
  return out;
}

export async function applyControl(
  code: string,
  token: string,
  command: ControlCommand,
): Promise<FacilitatorState> {
  const result = await getStore().update(normalizeCode(code), (draft) => {
    assertFacilitator(draft, token);

    switch (command.type) {
      /*
       * Opening the room for votes, and nothing else. Deliberately does not
       * jump to stage 0: a facilitator often walks the opening and lets people
       * join before pressing Start, and being thrown back to the title card at
       * that moment — in front of the room — is unrecoverable-looking. Use
       * Restart to actually start over.
       */
      case "start":
        draft.status = "live";
        draft.startedAt ??= Date.now();
        draft.overlay = null;
        break;

      case "pause":
        if (draft.status === "live") draft.status = "paused";
        break;

      case "resume":
        if (draft.status === "paused") draft.status = "live";
        break;

      case "restart":
        draft.responses = [];
        draft.phases = {};
        draft.snapshots = {};
        draft.stageIndex = 0;
        draft.beat = 0;
        draft.overlay = null;
        draft.status = "live";
        draft.startedAt = Date.now();
        draft.endedAt = null;
        break;

      /*
       * Next and Back walk beats first, stages second. Nothing here touches
       * `responses` or `phases`, so moving backwards through the activity and
       * forwards again cannot lose a revealed result or a vote.
       */
      case "next": {
        draft.overlay = null;

        /*
         * On a question the room has answered but nobody has revealed, Next
         * reveals instead of advancing.
         *
         * The whole point of the console is that a facilitator can run the
         * session on one key. That only holds if the one key cannot silently
         * walk past a vote the room just cast — losing the moment the entire
         * activity is built around. The sequence becomes: question open →
         * Next reveals → Next moves on. Reveal still exists for anyone who
         * wants to be explicit, and the jump menu still skips outright.
         */
        const question = stageQuestion(draft.stageIndex);
        if (question && (draft.phases[question.id] ?? "voting") !== "revealed") {
          revealQuestion(draft, question);
          break;
        }

        const stage = getStage(draft.stageIndex);
        const beat = clampBeat(draft.stageIndex, draft.beat);
        if (stage && beat < stage.beats - 1) {
          draft.beat = beat + 1;
        } else if (draft.stageIndex < STAGE_COUNT - 1) {
          draft.stageIndex += 1;
          draft.beat = 0;
        }
        break;
      }

      case "back": {
        draft.overlay = null;
        const beat = clampBeat(draft.stageIndex, draft.beat);
        if (beat > 0) {
          draft.beat = beat - 1;
        } else if (draft.stageIndex > 0) {
          draft.stageIndex -= 1;
          // Land on the fully-built version of the stage we are returning to.
          draft.beat = lastBeat(draft.stageIndex);
        }
        break;
      }

      case "goto": {
        draft.overlay = null;
        draft.stageIndex = clampStage(command.stageIndex);
        draft.beat = clampBeat(draft.stageIndex, command.beat ?? 0);
        break;
      }

      /*
       * On a voting stage, Reveal opens the result. On a narrative stage there
       * is nothing to tally, so the same key advances the disclosure — which is
       * what "facilitator presses reveal" means on the twist and cost screens.
       */
      case "reveal": {
        if (!setPhase(draft, "revealed")) {
          const stage = getStage(draft.stageIndex);
          const beat = clampBeat(draft.stageIndex, draft.beat);
          if (stage && beat < stage.beats - 1) draft.beat = beat + 1;
        }
        break;
      }

      case "hide":
      case "lock":
        setPhase(draft, "locked");
        break;

      case "unlock":
        setPhase(draft, "voting");
        break;

      /*
       * Overlay only. Deliberately touches nothing else — not the stage, not
       * the beat, not a phase, not a vote — so putting the join code back on
       * screen and taking it down again returns the room to exactly the frame
       * it left.
       */
      case "showJoin":
        draft.overlay = "join";
        break;

      case "hideJoin":
        draft.overlay = null;
        break;

      case "end":
        draft.status = "ended";
        draft.endedAt = Date.now();
        draft.stageIndex = STAGE_COUNT - 1;
        draft.beat = lastBeat(STAGE_COUNT - 1);
        draft.overlay = null;
        break;

      case "resetStage": {
        const q = command.questionId
          ? getQuestion(command.questionId)
          : stageQuestion(draft.stageIndex);
        if (!q) return false;
        draft.responses = draft.responses.filter((r) => r.questionId !== q.id);
        draft.phases[q.id] = "voting";
        clearSnapshot(draft, q.id);
        break;
      }

      case "settings":
        Object.assign(draft.settings, sanitizeSettings(command.patch ?? {}));
        break;

      case "simulate":
        seedSimulated(draft, Math.max(1, Math.min(300, Math.trunc(command.count ?? 30))));
        break;

      case "clearSimulated": {
        const ids = new Set(draft.participants.filter((p) => p.simulated).map((p) => p.id));
        draft.participants = draft.participants.filter((p) => !p.simulated);
        draft.responses = draft.responses.filter((r) => !ids.has(r.participantId));
        break;
      }

      default:
        return false;
    }
    return { ok: true };
  });

  if (!result) throw notFound();
  return buildFacilitatorState(result.session);
}

/* ------------------------------------------------------------------ */
/* Rehearsal mode                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fills the session with believable votes from flagged participants, so the
 * whole activity — including the verdict board and the final poll — can be
 * rehearsed alone. Every simulated participant is removable in one click.
 */
function seedSimulated(draft: SessionRecord, count: number) {
  const now = Date.now();
  const created: Participant[] = [];

  for (let i = 0; i < count; i += 1) {
    // Roughly the room/online mix a hybrid session actually sees.
    const mode: JoinMode = Math.random() < 0.62 ? "room" : "online";
    const participant: Participant = {
      id: uuid(),
      mode,
      joinedAt: now - Math.floor(Math.random() * 120_000),
      lastSeen: now,
      simulated: true,
      secret: participantSecret(),
    };
    draft.participants.push(participant);
    created.push(participant);
  }

  for (const question of QUESTIONS) {
    for (const participant of created) {
      const optionId = simulatedVote(question);
      if (!optionId) continue;
      draft.responses.push({
        id: uuid(),
        questionId: question.id,
        participantId: participant.id,
        mode: participant.mode,
        optionId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
