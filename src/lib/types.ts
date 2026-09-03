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
}

/**
 * One role's place on the TRAIN/FIRE board. Produced only for roles whose
 * question has been revealed, so the board builds up across the activity
 * rather than being reset or pre-filled.
 */
export interface BoardEntry {
  roleId: RoleId;
  title: string;
  quote: string;
  /** Majority side. On an exact tie this is "train" and `tie` is true. */
  verdict: Verdict;
  tie: boolean;
  trainCount: number;
  fireCount: number;
  trainPct: number;
  firePct: number;
  total: number;
  /** How many people chose the other side. Drives "N saw this differently". */
  minorityCount: number;
  minorityPct: number;
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
