/**
 * TRAIN OR FIRE — the activity script.
 *
 * Single source of truth for what a session contains: the incident, the four
 * roles, the failure chain, every projector stage and every private
 * facilitator note. Adding or reordering a stage means editing this file —
 * nothing in the store, transport, or control layers needs to change.
 *
 * Two ideas carry the whole model:
 *
 *  - A STAGE is one screen on the projector. Stages are indexed, and the
 *    facilitator's Next/Back/Jump move through that index.
 *  - A BEAT is progressive disclosure *within* a stage. The AAR chain, the
 *    cost list and the system question all build one line at a time, and the
 *    facilitator drives that with the same Next key. Beats live in session
 *    state, so pressing Back never loses where the room had got to.
 */

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export type RoleId = "engineer" | "finance" | "operations" | "maintenance";

/** The two destinations. Never rendered as colour alone — always word + mark. */
export type Verdict = "train" | "fire";

export interface Role {
  id: RoleId;
  /** "ROLE 01" — the projector's marker for this card. */
  marker: string;
  /** Projector heading. Job role only; the activity never uses personal names. */
  title: string;
  /** Sentence-case form for the verdict board and facilitator lists. */
  short: string;
  /** Two or three short lines. Deliberately not a paragraph. */
  facts: string[];
  /** Shorter still, for a 360px phone that must not scroll. */
  phoneFacts: string[];
  quote: string;
  questionId: string;
}

export const ROLES: Role[] = [
  {
    id: "engineer",
    marker: "ROLE 01",
    title: "Maintenance Engineer",
    short: "Maintenance Engineer",
    facts: [
      "Detected the warning signs.",
      "Raised the maintenance request.",
      "When nothing happened, continued monitoring but did not escalate further.",
    ],
    phoneFacts: [
      "Detected warning signs.",
      "Raised maintenance request.",
      "Didn't escalate further.",
    ],
    quote: "I raised it. It was documented.",
    questionId: "role-engineer",
  },
  {
    id: "finance",
    marker: "ROLE 02",
    title: "Finance Manager",
    short: "Finance Manager",
    facts: [
      "Rejected the OEM request because there wasn't enough budget.",
      "Asked the team to find a cheaper alternative.",
    ],
    phoneFacts: ["Rejected the OEM request.", "No budget available.", "Asked for something cheaper."],
    quote: "We couldn't afford the OEM.",
    questionId: "role-finance",
  },
  {
    id: "operations",
    marker: "ROLE 03",
    title: "Operations Manager",
    short: "Operations Manager",
    facts: [
      "Did not want to stop production before the planned shutdown.",
      "Approved continued operation with increased monitoring.",
    ],
    phoneFacts: [
      "Wouldn't stop production early.",
      "Approved continued operation.",
      "Increased monitoring instead.",
    ],
    quote: "The readings weren't at trip level yet.",
    questionId: "role-operations",
  },
  {
    id: "maintenance",
    marker: "ROLE 04",
    title: "Maintenance Manager",
    short: "Maintenance Manager",
    facts: [
      "Used a cheaper local technician instead of the OEM.",
      "The temporary adjustment improved the readings briefly.",
      "When deterioration returned, the machine continued operating.",
    ],
    phoneFacts: [
      "Used a cheaper local technician.",
      "Temporary fix improved readings.",
      "Kept running when they returned.",
    ],
    quote: "We needed a practical solution.",
    questionId: "role-maintenance",
  },
];

const roleById = new Map(ROLES.map((r) => [r.id, r]));
export const getRole = (id: RoleId | null | undefined): Role | null =>
  id ? (roleById.get(id) ?? null) : null;

/* ------------------------------------------------------------------ */
/* The incident                                                        */
/* ------------------------------------------------------------------ */

/** Full narrative — projector only, built one line per beat. */
export const INCIDENT_LINES: string[] = [
  "A critical production machine has failed, stopping operations.",
  "For several weeks, the machine had shown abnormal readings.",
  "Maintenance recommended preventive work and OEM support.",
  "The work didn't happen.",
  "Now production is down.",
];

/**
 * The scenario as it sits in the left column for the whole judging sequence.
 *
 * Split into runs so a handful of phrases can carry bold weight — the ones a
 * facilitator points at — without tinting the panel with colour. This is a
 * briefing someone glances back at mid-decision, so it stays sentences rather
 * than the fragments used later.
 */
export interface BriefRun {
  t: string;
  /** Load-bearing phrase. Weight only; never a second colour. */
  b?: boolean;
}

export const INCIDENT_BRIEF: BriefRun[][] = [
  [{ t: "A " }, { t: "critical production machine", b: true }, { t: " has failed, stopping operations." }],
  [{ t: "For several weeks, the machine showed " }, { t: "abnormal readings", b: true }, { t: "." }],
  [{ t: "Preventive work", b: true }, { t: " and " }, { t: "OEM support", b: true }, { t: " were recommended." }],
  [{ t: "The work didn\u2019t happen." }],
  [{ t: "Now " }, { t: "production is down", b: true }, { t: "." }],
];

/**
 * The compact restatement that lives beside the decision arena for the whole
 * judging stage. Fragments, not sentences — the room has already read the
 * narrative once and now needs it only as a reference.
 */
export const EVIDENCE_LINES: string[] = [
  "Critical machine failure.",
  "Warnings existed.",
  "Preventive work recommended.",
  "OEM request declined.",
  "Production continued.",
  "Temporary fix attempted.",
  "Machine failed.",
];

/* ------------------------------------------------------------------ */
/* The failure chain                                                   */
/* ------------------------------------------------------------------ */

export interface ChainLink {
  /** 1-based; matches the chain-question option ids. */
  n: number;
  title: string;
  detail: string[];
  /** The intervention that was available here. Absent on the terminal link. */
  opportunity: string | null;
  /** True for link 7 — the failure itself, not an opportunity. */
  terminal?: boolean;
}

export const CHAIN: ChainLink[] = [
  {
    n: 1,
    title: "Warning detected",
    detail: ["Abnormal readings appeared."],
    opportunity: "Opportunity to act",
  },
  {
    n: 2,
    title: "Preventive work recommended",
    detail: ["OEM intervention requested."],
    opportunity: "Opportunity to act",
  },
  {
    n: 3,
    title: "No budget",
    detail: ["Preferred intervention not funded."],
    opportunity: "Opportunity to escalate",
  },
  {
    n: 4,
    title: "Keep production running",
    detail: ["Continued operation chosen."],
    opportunity: "Opportunity to reassess",
  },
  {
    n: 5,
    title: "Temporary fix",
    detail: ["Readings improved.", "The underlying problem remained."],
    opportunity: "Opportunity to verify",
  },
  {
    n: 6,
    title: "Warning returns",
    detail: ["Deterioration came back."],
    opportunity: "Opportunity to stop",
  },
  {
    n: 7,
    title: "Failure",
    detail: ["Production stops."],
    opportunity: null,
    terminal: true,
  },
];

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export type QuestionKind =
  /** TRAIN or FIRE for one role. Exactly two options, always. */
  | "verdict"
  /** Pick exactly one from a list. */
  | "single";

export interface Option {
  id: string;
  label: string;
  /** Chain link this option points at, for the chain question only. */
  chainN?: number;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  /** Short label for the facilitator's stage list. */
  short: string;
  /** Projector wording. */
  prompt: string;
  /** Phone wording, when the projector's is too long for 360px. */
  participantPrompt?: string;
  options: Option[];
  roleId?: RoleId;
}

const verdictQuestion = (role: Role): Question => ({
  id: role.questionId,
  kind: "verdict",
  short: role.short,
  prompt: "What would you do?",
  options: [
    { id: `${role.questionId}:train`, label: "Train" },
    { id: `${role.questionId}:fire`, label: "Fire" },
  ],
  roleId: role.id,
});

export const CHAIN_QUESTION_ID = "chain-break";
export const FAILED_FIRST_QUESTION_ID = "failed-first";

export const QUESTIONS: Question[] = [
  ...ROLES.map(verdictQuestion),
  {
    id: CHAIN_QUESTION_ID,
    kind: "single",
    short: "Break the chain",
    prompt: "Where should the chain have been broken?",
    participantPrompt: "Where should the chain have been broken?",
    options: CHAIN.filter((link) => !link.terminal).map((link) => ({
      id: `chain:${link.n}`,
      label: link.title,
      chainN: link.n,
    })),
  },
  {
    id: FAILED_FIRST_QUESTION_ID,
    kind: "single",
    short: "What failed first",
    prompt: "What actually failed first?",
    options: [
      "The machine",
      "Preventive maintenance",
      "Escalation",
      "Communication",
      "Decision-making",
      "Leadership",
      "The system",
    ].map((label, i) => ({ id: `failed:${i + 1}`, label })),
  },
];

const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
export const getQuestion = (id: string | null | undefined): Question | null =>
  id ? (questionById.get(id) ?? null) : null;

/** The two option ids of a verdict question, in TRAIN, FIRE order. */
export function verdictOptionId(questionId: string, verdict: Verdict): string {
  return `${questionId}:${verdict}`;
}

/* ------------------------------------------------------------------ */
/* Static content used by the later stages                             */
/* ------------------------------------------------------------------ */

export const SYSTEM_REPLACEMENTS: { role: string; unchanged: string }[] = [
  { role: "New Maintenance Engineer.", unchanged: "Same escalation process." },
  { role: "New Finance Manager.", unchanged: "Same budget pressure." },
  { role: "New Operations Manager.", unchanged: "Same production pressure." },
  { role: "New Maintenance Manager.", unchanged: "Same shortcut culture." },
];

export interface Learning {
  /** Broken into lines so the projector controls where the headline wraps. */
  headline: string[];
  body: string;
}

export const LEARNINGS: Learning[] = [
  {
    headline: ["Warning signs", "are information."],
    body: "Preventive checks create an opportunity to act before failure chooses the timing.",
  },
  {
    headline: ["“No budget”", "doesn't remove", "the risk."],
    body: "If the preferred solution cannot be funded, the risk still requires a technically sound alternative or escalation.",
  },
  {
    headline: ["A workaround", "is not a shortcut."],
    body: "Temporary solutions still require technical assessment, competence, authorization and monitoring.",
  },
  {
    headline: ["Production", "depends on", "integrity."],
    body: "Reliable equipment protects reliable production.",
  },
];

/** No figures. The point is cost consequence, not invented precision. */
export const COST_ITEMS: string[] = [
  "Emergency repair",
  "OEM mobilisation",
  "Replacement parts",
  "Lost production",
  "Recovery time",
  "Secondary damage",
];

export const FINAL_TRUTHS: { lead: string; body: string[] }[] = [
  { lead: "There can be", body: ["alternative solutions."] },
  { lead: "There can be", body: ["temporary solutions."] },
  { lead: "But there is", body: ["no shortcut around", "equipment integrity."] },
];

/* ------------------------------------------------------------------ */
/* Facilitator notes — never rendered on the projector                 */
/* ------------------------------------------------------------------ */

export interface FacilitatorNote {
  /** The question to put to the room. */
  ask?: string;
  /** A follow-up when the first answer is thin. */
  probe?: string;
  /** What this stage is for. */
  learning?: string;
  /** 30–60 seconds of prepared talking point. */
  talkingPoint?: string;
}

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

export type StageKind =
  | "opening"
  | "join"
  | "incident"
  | "prelude"
  | "decision"
  | "verdict"
  | "twist"
  | "rewind"
  | "question"
  | "system"
  | "learning"
  | "cost-claim"
  | "cost-reality"
  | "final"
  | "truth"
  | "closing";

/**
 * What the left column of the shell is doing.
 *
 * `briefing` — the incident, for the whole judging sequence.
 * `known`    — the compressed facts, for the AAR.
 * `quiet`    — nothing but the wordmark, so a single sentence can own the room.
 */
export type PanelMode = "briefing" | "known" | "quiet";

export interface Stage {
  id: string;
  kind: StageKind;
  /** Facilitator-facing name, used in the stage list and jump menu. */
  label: string;
  /** Grouping for the jump menu. */
  chapter: string;
  /** How many progressive-disclosure beats this stage has. Always >= 1. */
  beats: number;
  /** What the persistent left column shows while this stage is up. */
  panel: PanelMode;
  questionId?: string;
  roleId?: RoleId;
  learningIndex?: number;
  note: FacilitatorNote;
}

const decisionStage = (role: Role, note: FacilitatorNote): Stage => ({
  id: `decide-${role.id}`,
  kind: "decision",
  panel: "briefing",
  // The chapter heading already says "The decision", so the role name alone is
  // enough — and short enough that Engineer and Manager stay distinguishable in
  // the sidebar rather than both truncating to "Maintena…".
  label: role.short,
  chapter: "The decision",
  beats: 1,
  questionId: role.questionId,
  roleId: role.id,
  note,
});

export const STAGES: Stage[] = [
  {
    id: "opening",
    kind: "opening",
    panel: "quiet",
    label: "Opening",
    chapter: "Open",
    beats: 2,
    note: {
      ask: "Don't explain the activity yet. Let the title sit on screen.",
      learning: "The room should arrive curious, not briefed.",
      talkingPoint:
        "Two words. That's the whole decision we're going to make today, four times over. Before we start, I want you to notice how quickly you'll form an opinion — and how little you'll actually know when you form it.",
    },
  },
  {
    id: "join",
    kind: "join",
    panel: "quiet",
    label: "Join",
    chapter: "Open",
    beats: 1,
    note: {
      ask: "Scan the code, then choose whether you're in the room or online.",
      probe: "Anyone not able to join? Read the code out once more.",
      learning: "Get everyone connected before the first decision — late joiners dilute the first vote.",
      talkingPoint:
        "Hold here until the participant count stops climbing. The corner code stays up during voting, so a latecomer can still join — but the first role is the one everyone should see together.",
    },
  },
  {
    id: "incident",
    kind: "incident",
    panel: "quiet",
    label: "The incident",
    chapter: "Open",
    beats: INCIDENT_LINES.length,
    note: {
      ask: "Read each line out as it appears. Then stop.",
      learning: "Everyone judges the same facts. No extra narrative, no hints.",
      talkingPoint:
        "Notice what we have not told you: no names, no site, no numbers. You have exactly the information a manager usually has on the morning after — and that is the point.",
    },
  },
  {
    id: "prelude",
    kind: "prelude",
    panel: "quiet",
    label: "Four decisions",
    chapter: "Open",
    beats: 2,
    note: {
      ask: "Four people were involved. You're going to decide about each of them.",
      learning: "Frame the task as judgement, deliberately, so the twist later has something to land on.",
      talkingPoint:
        "Train, or fire. That's the only choice you get — and yes, that's an unfair constraint. Keep hold of how it feels to be forced into it.",
    },
  },
  decisionStage(ROLES[0], {
    ask: "Could this person alone have prevented the failure?",
    probe: "What would you need to know before firing them?",
    learning: "Raising a request is not the same as escalating a risk — but the system has to make escalation possible.",
    talkingPoint:
      "This one usually splits the room. Some people see someone who did their job and documented it. Others see someone who watched a known risk sit still for weeks. Both readings are defensible, and the gap between them is where your escalation procedure lives.",
  }),
  decisionStage(ROLES[1], {
    ask: "Was this a financial decision or a risk decision?",
    probe: "Who was responsible for saying 'no budget doesn't mean no risk'?",
    learning: "Declining funding transfers risk; it never removes it.",
    talkingPoint:
      "Finance is usually the easiest one to fire, because the decision looks like a spreadsheet. Ask the room what information Finance was given. A rejected line item and a rejected risk assessment are very different documents.",
  }),
  decisionStage(ROLES[2], {
    ask: "Was continued operation an unreasonable decision at the time?",
    probe: "What would have had to be true for stopping production to be the obvious call?",
    learning: "Judgement made under production pressure looks different before the failure than after it.",
    talkingPoint:
      "'The readings weren't at trip level yet' is technically true and completely insufficient. Trip levels tell you when the machine will protect itself. They don't tell you when you should have intervened.",
  }),
  decisionStage(ROLES[3], {
    ask: "Was the temporary fix wrong, or was the way it was used wrong?",
    probe: "Who authorised the workaround, and who verified it?",
    learning: "Temporary solutions are legitimate engineering — unassessed ones are not.",
    talkingPoint:
      "Watch how the room reacts to 'the readings improved'. A temporary fix that hides a symptom is more dangerous than no fix at all, because it buys silence.",
  }),
  {
    id: "verdict",
    kind: "verdict",
    panel: "briefing",
    label: "Our verdict",
    chapter: "The decision",
    beats: 1,
    note: {
      ask: "Why were we more willing to fire some roles than others?",
      probe: "What information would you need before actually firing them?",
      learning:
        "Accountability matters, but individual blame can hide systemic weaknesses. The board is the room's own judgement — let them look at it before you challenge it.",
      talkingPoint:
        "Pause here. Don't advance. Let people read the board and argue with it. The strongest discussions come from the minority percentages, not the majorities — someone in this room disagreed with every one of these calls.",
    },
  },
  {
    id: "twist",
    kind: "twist",
    panel: "quiet",
    label: "You fired someone",
    chapter: "The turn",
    beats: 2,
    note: {
      ask: "Say nothing on the first screen. Let it be uncomfortable.",
      probe: "Reveal the second line only when the room has gone quiet.",
      learning: "The pivot from judging people to examining the system.",
      talkingPoint:
        "Firing is a decision that feels like action. It closes a case. What it rarely does is change the conditions that produced the case.",
    },
  },
  {
    id: "rewind",
    kind: "rewind",
    panel: "known",
    label: "Let's rewind",
    chapter: "Rewind",
    beats: CHAIN.length,
    note: {
      ask: "Count the opportunities out loud as they appear.",
      probe: "How many chances did this organisation have to stop this?",
      learning: "A failure is a chain, not an event. Every link was a decision someone could have made differently.",
      talkingPoint:
        "Six opportunities. Not one bad actor — six moments where a normal person, doing a normal job, could have broken the chain. Failures almost never need a villain. They need a sequence.",
    },
  },
  {
    id: "chain-question",
    kind: "question",
    panel: "known",
    label: "Break the chain",
    chapter: "Rewind",
    beats: 1,
    questionId: CHAIN_QUESTION_ID,
    note: {
      ask: "There is no correct answer here. Ask the people who chose the least popular link why.",
      probe: "If we'd broken it at your point, what would have had to change for that to be possible?",
      learning: "Multiple intervention points existed. Spread of opinion is the finding, not a problem to resolve.",
      talkingPoint:
        "Look at the spread. Every one of those links got votes, which means the room can see six different ways this could have gone differently. An organisation that can only see one is an organisation with one point of failure.",
    },
  },
  {
    id: "system",
    kind: "system",
    panel: "known",
    label: "Did you fix the system?",
    chapter: "Rewind",
    beats: 2 + SYSTEM_REPLACEMENTS.length + 1,
    note: {
      ask: "What happens next time?",
      probe: "Which of these four conditions is actually true in our organisation today?",
      learning: "Replacing people without changing conditions reproduces the failure.",
      talkingPoint:
        "Take the verbal answers before you reveal the last line. Someone will say 'the same thing happens' — let them say it, not the screen.",
    },
  },
  {
    id: "failed-first",
    kind: "question",
    panel: "known",
    label: "What failed first",
    chapter: "Learn",
    beats: 1,
    questionId: FAILED_FIRST_QUESTION_ID,
    note: {
      ask: "Don't declare a correct answer. Ask two people with different answers to explain.",
      probe: "If the machine failed last, what failed first?",
      learning: "Naming the first failure is the beginning of fixing it. Most rooms are split between 'escalation' and 'the system'.",
      talkingPoint:
        "Whatever the room picks, notice how few people pick 'the machine'. We started this session ready to fire four people over a piece of equipment, and almost nobody thinks the equipment is where it started.",
    },
  },
  ...LEARNINGS.map<Stage>((learning, i) => ({
    id: `learning-${i + 1}`,
    kind: "learning",
    panel: "quiet",
    label: `Learning ${i + 1}`,
    chapter: "Learn",
    beats: 2,
    learningIndex: i,
    note: [
      {
        ask: "When did we last treat an abnormal reading as information rather than noise?",
        learning: "Warning signs are data. Failure chooses the timing when we don't.",
        talkingPoint:
          "Preventive maintenance is not about the machine. It's about who chooses the moment the machine stops — you, on a Tuesday, or the machine, on the worst day of your quarter.",
      },
      {
        ask: "When a request is rejected here, where does the risk go?",
        probe: "Who owns the risk after 'no'?",
        learning: "A rejected budget line is a transferred risk that still needs an owner.",
        talkingPoint:
          "'No budget' is a legitimate answer to a funding request. It is not an answer to a risk. If we can't fund the preferred solution, someone still has to sign for the alternative — or escalate it to someone who can.",
      },
      {
        ask: "What does a workaround need before it's allowed to run?",
        probe: "Who signs off on a temporary solution in our process?",
        learning: "Assessment, competence, authorisation, monitoring — four things a shortcut skips.",
        talkingPoint:
          "There's nothing wrong with a temporary fix. There's a great deal wrong with a temporary fix that nobody assessed, nobody authorised, and nobody put an expiry date on.",
      },
      {
        ask: "Do we treat integrity as a cost centre or as production capacity?",
        learning: "Equipment integrity is production capacity, not overhead.",
        talkingPoint:
          "Every hour of production we have ever delivered was delivered by equipment that was fit to run. Integrity isn't what competes with production. It's what production is made of.",
      },
    ][i] as FacilitatorNote,
  })),
  {
    id: "cost-claim",
    kind: "cost-claim",
    panel: "quiet",
    label: "We couldn't afford it",
    chapter: "Cost",
    beats: 1,
    note: {
      ask: "Read the quote. Then wait.",
      learning: "Set up the reframe. Don't rush it.",
      talkingPoint:
        "This sentence is said in good faith in every organisation, every year. It's almost always true at the moment it's said.",
    },
  },
  {
    id: "cost-reality",
    kind: "cost-reality",
    panel: "quiet",
    label: "Can we afford the failure?",
    chapter: "Cost",
    beats: 1 + COST_ITEMS.length,
    note: {
      ask: "Which of these did we budget for?",
      probe: "Which of these is the biggest, and did anyone forecast it?",
      learning: "The cost of prevention is visible and small. The cost of failure is invisible until it isn't.",
      talkingPoint:
        "Don't put numbers on these. The room will put their own numbers on them, and theirs will be more persuasive than anything we could invent. The only comparison that matters is: one of these lists was in a budget, and one of them wasn't.",
    },
  },
  {
    id: "final-machine",
    kind: "final",
    panel: "quiet",
    label: "The machine failed last",
    chapter: "Close",
    beats: 2,
    note: {
      ask: "Let the first line stand alone for a few seconds.",
      learning: "Reorder the room's mental sequence of the failure.",
      talkingPoint:
        "The trip is the only part of this that showed up in a report. Everything that actually caused it happened weeks earlier, in meetings, in emails, and in decisions that all looked reasonable at the time.",
    },
  },
  {
    id: "final-truth",
    kind: "truth",
    panel: "quiet",
    label: "No shortcut",
    chapter: "Close",
    beats: FINAL_TRUTHS.length,
    note: {
      ask: "Reveal one line at a time.",
      learning: "The closing principle: alternatives and temporary solutions are legitimate; shortcuts around integrity are not.",
      talkingPoint:
        "We are not asking anyone to spend money they don't have. We're asking that when the preferred solution isn't available, the alternative is engineered — not improvised.",
    },
  },
  {
    id: "closing",
    kind: "closing",
    panel: "quiet",
    label: "Closing",
    chapter: "Close",
    beats: 2,
    note: {
      ask: "What would you do differently before the next warning?",
      probe: "Name one thing you will change this month.",
      learning: "End on commitment, not on conclusion.",
      talkingPoint:
        "Take three answers, out loud, and write them down where people can see them. A session that ends on a slide ends. A session that ends on three commitments carries.",
    },
  },
];

export const STAGE_COUNT = STAGES.length;

const stageById = new Map(STAGES.map((s) => [s.id, s]));

export function getStage(index: number): Stage | null {
  if (!Number.isFinite(index) || index < 0 || index >= STAGES.length) return null;
  return STAGES[index];
}

export function stageIndexById(id: string): number {
  return STAGES.findIndex((s) => s.id === id);
}

export const getStageById = (id: string): Stage | null => stageById.get(id) ?? null;

/** The question on screen at `index`, or null for a non-voting stage. */
export function stageQuestion(index: number): Question | null {
  const stage = getStage(index);
  return stage?.questionId ? getQuestion(stage.questionId) : null;
}

/** Beats are 0-based and clamped to the stage that owns them. */
export function clampBeat(index: number, beat: number): number {
  const stage = getStage(index);
  if (!stage) return 0;
  return Math.max(0, Math.min(stage.beats - 1, Math.trunc(beat) || 0));
}

/** Every stage that collects a vote, in order. */
export const QUESTION_STAGES = STAGES.filter((s) => Boolean(s.questionId));

/** Chapters in order, for the facilitator's jump menu. */
export const CHAPTERS: string[] = [...new Set(STAGES.map((s) => s.chapter))];
