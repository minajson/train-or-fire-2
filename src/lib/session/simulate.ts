import {
  CHAIN_QUESTION_ID,
  FAILED_FIRST_QUESTION_ID,
  QUESTIONS,
  ROLES,
  verdictOptionId,
  type Question,
} from "@/lib/content/activity";

/**
 * Believable answers for rehearsal.
 *
 * Weights are chosen so a dry run produces a *mixed* board — two roles trained,
 * two fired — because a board that lands all four on one side would let a
 * facilitator rehearse without ever seeing the layout the real room produces.
 * They are not a prediction and never touch a live session's real votes.
 */
const TRAIN_BIAS: Record<string, number> = {
  engineer: 0.72,
  finance: 0.55,
  operations: 0.42,
  maintenance: 0.36,
};

/** Rough shape of where a room tends to say the chain should have broken. */
const CHAIN_WEIGHTS = [0.1, 0.15, 0.27, 0.2, 0.18, 0.1];

/** "The machine" is deliberately the least-picked option. */
const FAILED_FIRST_WEIGHTS = [0.04, 0.16, 0.24, 0.13, 0.15, 0.12, 0.16];

function weightedIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

/** The option a simulated participant picks, or null to abstain. */
export function simulatedVote(question: Question): string | null {
  // A few people never vote. A projector that always reads 30/30 teaches a
  // facilitator to expect something they will not get.
  if (Math.random() < 0.07) return null;

  if (question.kind === "verdict") {
    const role = ROLES.find((r) => r.questionId === question.id);
    const bias = role ? (TRAIN_BIAS[role.id] ?? 0.5) : 0.5;
    return verdictOptionId(question.id, Math.random() < bias ? "train" : "fire");
  }

  if (question.id === CHAIN_QUESTION_ID) {
    return question.options[weightedIndex(CHAIN_WEIGHTS)]?.id ?? null;
  }

  if (question.id === FAILED_FIRST_QUESTION_ID) {
    return question.options[weightedIndex(FAILED_FIRST_WEIGHTS)]?.id ?? null;
  }

  const i = Math.floor(Math.random() * question.options.length);
  return question.options[i]?.id ?? null;
}

export const ALL_QUESTIONS = QUESTIONS;
