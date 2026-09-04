import type { RoleId, Stage, Verdict } from "@/lib/content/activity";

export type SessionStatus = "lobby" | "live" | "paused" | "ended";

/**
 * A temporary takeover of the projector that leaves the session running
 * underneath it. The facilitator can put the join QR back on screen for late
 * arrivals without disturbing the stage in progress.
 */
export type Overlay = "join" | null;

/** Per-question lifecycle, driven entirely by the facilitator. */
export type Phase = "voting" | "locked" | "revealed";

export type JoinMode = "room" | "online";

export interface Participant {
  id: string;
  mode: JoinMode;
  joinedAt: number;
  lastSeen: number;
  simulated: boolean;
  /**
   * Issued once at join, held only by the server and that one device. Proves
   * "this vote is mine" without ever identifying who cast it.
   */
  secret: string;
}

export interface ResponseRecord {
  id: string;
  questionId: string;
  participantId: string;
  mode: JoinMode;
  optionId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * What the room actually decided on one question, frozen at the instant the
 * facilitator revealed it.
 *
 * This is the fix for the worst failure this app can have in front of a room:
 * a result that was on the wall a minute ago coming back as 0%. Percentages
 * were previously derived from `responses` on every read, which is correct
 * while nothing removes a response — but "restart", "clear simulated" and a
 * cleared stage all can, and a revealed number that quietly recomputes itself
 * is a number the facilitator cannot trust in front of an audience.
 *
 * So reveal writes down what it revealed. Counts, not percentages: the shape
 * survives a schema change and the arithmetic stays in one place. Nothing but
 * an explicit reopen (unlock / reset / restart) ever removes one.
 */
export interface ResultSnapshot {
  questionId: string;
  revealedAt: number;
  /** optionId → votes, at reveal. Options with no votes are present as 0. */
  counts: Record<string, number>;
  roomCounts: Record<string, number>;
  onlineCounts: Record<string, number>;
  totalResponses: number;
  roomResponses: number;
  onlineResponses: number;
}

export interface SessionSettings {
  /** Corner QR on voting stages, and the big QR on the join stage. */
  showQr: boolean;
  /** Master mute across projector and phones. */
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  showQr: true,
  soundEnabled: true,
};

export interface SessionRecord {
  id: string;
  code: string;
  facilitatorToken: string;
  title: string;
  status: SessionStatus;
  stageIndex: number;
  /** Progressive-disclosure position inside the current stage. */
  beat: number;
  overlay: Overlay;
  /** questionId → phase. Missing means "voting". */
  phases: Record<string, Phase>;
  /**
   * questionId → the result as it was when revealed. Written by reveal, and
   * removed only by unlock, resetStage or restart. Sessions created before
   * this field existed simply have none, and fall back to a live tally.
   */
  snapshots?: Record<string, ResultSnapshot>;
  settings: SessionSettings;
  /** Bumped on every persisted mutation; clients use it to drop stale frames. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  participants: Participant[];
  responses: ResponseRecord[];
}

/* ------------------------------------------------------------------ */
/* Public (client-facing) shapes — never carry identity or tokens      */
/* ------------------------------------------------------------------ */

export interface LiveCounts {
  total: number;
  room: number;
  online: number;
  /** Participants who have voted on the question currently on screen. */
  responses: number;
}

export interface OptionTally {
  optionId: string;
  label: string;
  count: number;
  pct: number;
  roomCount: number;
  onlineCount: number;
}

export interface QuestionResults {
  questionId: string;
  totalResponses: number;
  roomResponses: number;
  onlineResponses: number;
  options: OptionTally[];
  /** The option with the most votes; null when nobody voted. */
  leadingOptionId: string | null;
  /** True when two or more options share the lead. */
  tie: boolean;
  /**
   * False when nobody answered. Every surface reads this instead of inferring
   * emptiness from `0%` — "TRAIN 0% / FIRE 0%" and "nobody voted" are
   * different statements, and only one of them is ever true.
   */
  hasVotes: boolean;
  /** When this result was frozen, if it came from a snapshot. */
  revealedAt: number | null;
}

/**
 * Where a role stands on the TRAIN/FIRE board.
 *
 *  `train` / `fire` — a real majority, from real votes.
 *  `split`         — an exact tie. The role sits between the zones rather than
 *                    being assigned to one by a tiebreak nobody voted for.
 *  `pending`       — revealed with nobody having voted. The board says so in
 *                    words; it never renders this as 0%.
 */
export type Placement = "train" | "fire" | "split" | "pending";

/**
 * One role's place on the TRAIN/FIRE board.
 *
 * Built from the reveal snapshot when there is one, so a role that has been on
 * the wall keeps exactly the numbers it was shown with — through Back, Next, a
 * reload, a redeploy, and a facilitator clearing the simulated crowd.
 *
 * A role appears only once its own question has been revealed, so the board
 * builds up across the activity rather than being reset or pre-filled.
 */
export interface BoardEntry {
  roleId: RoleId;
  title: string;
  quote: string;
  /** Short evidence, carried with the result so a revisit is never a naked %. */
  facts: string[];
  placement: Placement;
  /** Majority side. Null on a split or a pending role — never guessed. */
  verdict: Verdict | null;
  tie: boolean;
  /** False when the question was revealed with no votes. */
  hasVotes: boolean;
  trainCount: number;
  fireCount: number;
  trainPct: number;
  firePct: number;
  total: number;
  /** How many people chose the other side. Drives "N saw this differently". */
  minorityCount: number;
  minorityPct: number;
  /** Order the room decided them in, 1-based. Drives the verdict wall entrance. */
  order: number;
  /**
   * When this result was frozen. Null only for a session that predates
   * snapshots. Screens compare it against `serverTime` to tell a reveal
   * happening NOW from a result coming back on screen, and animate only the
   * first — see `useCountUp`.
   */
  revealedAt: number | null;
}

export interface PublicSessionState {
  code: string;
  title: string;
  status: SessionStatus;
  stageIndex: number;
  stageCount: number;
  stage: Stage | null;
  beat: number;
  phase: Phase;
  /**
   * Whether the screen currently on the projector is one the room can answer.
   *
   * This is the single rule that decides whether the join QR is up. Stated once
   * here, on the state every surface already reads, rather than re-derived per
   * screen — a question that forgets to show the code is a latecomer who cannot
   * join, and that is not a mistake worth leaving room for.
   */
  requiresParticipantResponse: boolean;
  overlay: Overlay;
  counts: LiveCounts;
  settings: SessionSettings;
  /**
   * Only populated once the facilitator has revealed. Nothing about the split
   * reaches any screen before that — not the projector, not a phone.
   */
  results: QuestionResults | null;
  /** Roles already placed on the board, in role order. */
  board: BoardEntry[];
  /**
   * The requesting participant's own vote on the current question, so a
   * refresh mid-stage restores what they chose. Never populated for the
   * projector, and never contains anyone else's vote.
   */
  you: { answered: boolean; optionId: string | null } | null;
  serverTime: number;
  revision: number;
}

/* ------------------------------------------------------------------ */
/* Facilitator-only view                                               */
/* ------------------------------------------------------------------ */

export interface StageProgress {
  stageIndex: number;
  stageId: string;
  label: string;
  chapter: string;
  questionId: string | null;
  responses: number;
  phase: Phase | null;
}

export interface FacilitatorState extends PublicSessionState {
  progress: StageProgress[];
  simulatedCount: number;
  /**
   * Results for the question on screen regardless of phase, so the facilitator
   * can see the split before deciding to reveal it. Public state never has it.
   */
  preview: QuestionResults | null;
}

/* ------------------------------------------------------------------ */
/* Control commands                                                    */
/* ------------------------------------------------------------------ */

export type ControlCommand =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; stageIndex: number; beat?: number }
  | { type: "reveal" }
  | { type: "hide" }
  | { type: "lock" }
  | { type: "unlock" }
  | { type: "showJoin" }
  | { type: "hideJoin" }
  | { type: "end" }
  | { type: "resetStage"; questionId?: string }
  | { type: "settings"; patch: Partial<SessionSettings> }
  | { type: "simulate"; count?: number }
  | { type: "clearSimulated" };
