import type { Question } from "@/lib/content/activity";
import type { OptionTally, QuestionResults, ResponseRecord, SessionRecord } from "@/lib/types";

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function responsesFor(session: SessionRecord, questionId: string): ResponseRecord[] {
  return session.responses.filter((r) => r.questionId === questionId);
}

export function responseCount(session: SessionRecord, questionId: string): number {
  return responsesFor(session, questionId).length;
}

/**
 * Counts one question. Every question in this activity is single-select, so
 * the denominator is simply "people who voted" and the percentages always sum
 * to 100 — which matters, because the projector puts two of them side by side
 * and the room will check the arithmetic.
 */
export function tallyQuestion(session: SessionRecord, question: Question): QuestionResults {
  const responses = responsesFor(session, question.id);
  const total = responses.length;

  const options: OptionTally[] = question.options.map((option) => {
    const mine = responses.filter((r) => r.optionId === option.id);
    return {
      optionId: option.id,
      label: option.label,
      count: mine.length,
      pct: pct(mine.length, total),
      roomCount: mine.filter((r) => r.mode === "room").length,
      onlineCount: mine.filter((r) => r.mode === "online").length,
    };
  });

  const best = options.reduce((max, o) => Math.max(max, o.count), 0);
  const leaders = options.filter((o) => o.count === best && best > 0);

  return {
    questionId: question.id,
    totalResponses: total,
    roomResponses: responses.filter((r) => r.mode === "room").length,
    onlineResponses: responses.filter((r) => r.mode === "online").length,
    options,
    leadingOptionId: leaders.length === 1 ? leaders[0].optionId : (leaders[0]?.optionId ?? null),
    tie: leaders.length > 1,
  };
}
