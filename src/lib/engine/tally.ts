import type { Question } from "@/lib/content/activity";
import type {
  OptionTally,
  QuestionResults,
  ResponseRecord,
  ResultSnapshot,
  SessionRecord,
} from "@/lib/types";

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function responsesFor(session: SessionRecord, questionId: string): ResponseRecord[] {
  return session.responses.filter((r) => r.questionId === questionId);
}

export function responseCount(session: SessionRecord, questionId: string): number {
  return responsesFor(session, questionId).length;
}

export function snapshotFor(
  session: SessionRecord,
  questionId: string,
): ResultSnapshot | null {
  return session.snapshots?.[questionId] ?? null;
}

/**
 * Freezes the current count for a question.
 *
 * Called at exactly one moment — the transition into `revealed` — so that what
 * went on the wall is written down rather than recomputed later from a
 * response list that the facilitator is still allowed to change.
 */
export function captureSnapshot(session: SessionRecord, question: Question): ResultSnapshot {
  const responses = responsesFor(session, question.id);
  const counts: Record<string, number> = {};
  const roomCounts: Record<string, number> = {};
  const onlineCounts: Record<string, number> = {};

  // Every option is present, including the ones nobody chose. A missing key
  // and a zero are the same fact, and only one of them survives a round trip
  // through JSON without a reader having to guess.
  for (const option of question.options) {
    counts[option.id] = 0;
    roomCounts[option.id] = 0;
    onlineCounts[option.id] = 0;
  }

  for (const r of responses) {
    if (!(r.optionId in counts)) continue;
    counts[r.optionId] += 1;
    if (r.mode === "room") roomCounts[r.optionId] += 1;
    else onlineCounts[r.optionId] += 1;
  }

  return {
    questionId: question.id,
    revealedAt: Date.now(),
    counts,
    roomCounts,
    onlineCounts,
    totalResponses: responses.length,
    roomResponses: responses.filter((r) => r.mode === "room").length,
    onlineResponses: responses.filter((r) => r.mode === "online").length,
  };
}

function resultsFrom(
  question: Question,
  read: (optionId: string) => { count: number; room: number; online: number },
  totals: { total: number; room: number; online: number },
  revealedAt: number | null,
): QuestionResults {
  const options: OptionTally[] = question.options.map((option) => {
    const { count, room, online } = read(option.id);
    return {
      optionId: option.id,
      label: option.label,
      count,
      pct: pct(count, totals.total),
      roomCount: room,
      onlineCount: online,
    };
  });

  const best = options.reduce((max, o) => Math.max(max, o.count), 0);
  const leaders = options.filter((o) => o.count === best && best > 0);

  return {
    questionId: question.id,
    totalResponses: totals.total,
    roomResponses: totals.room,
    onlineResponses: totals.online,
    options,
    leadingOptionId: leaders.length === 1 ? leaders[0].optionId : (leaders[0]?.optionId ?? null),
    tie: leaders.length > 1,
    hasVotes: totals.total > 0,
    revealedAt,
  };
}

/**
 * Counts one question, live.
 *
 * Every question in this activity is single-select, so the denominator is
 * simply "people who voted" and the percentages always sum to 100 — which
 * matters, because the projector puts two of them side by side and the room
 * will check the arithmetic.
 *
 * This is what the facilitator's private preview reads, because a preview
 * should track the room in real time. What the ROOM sees comes from
 * `revealedResults` below.
 */
export function tallyQuestion(session: SessionRecord, question: Question): QuestionResults {
  const responses = responsesFor(session, question.id);
  const byOption = new Map<string, { count: number; room: number; online: number }>();
  for (const r of responses) {
    const cell = byOption.get(r.optionId) ?? { count: 0, room: 0, online: 0 };
    cell.count += 1;
    if (r.mode === "room") cell.room += 1;
    else cell.online += 1;
    byOption.set(r.optionId, cell);
  }

  return resultsFrom(
    question,
    (id) => byOption.get(id) ?? { count: 0, room: 0, online: 0 },
    {
      total: responses.length,
      room: responses.filter((r) => r.mode === "room").length,
      online: responses.filter((r) => r.mode === "online").length,
    },
    null,
  );
}

/**
 * The result as the room saw it — the snapshot taken at reveal.
 *
 * Falls back to a live tally when there is no snapshot, which covers exactly
 * one case: a session that was already running when this field was introduced.
 * A revealed question is never left without a number.
 */
export function revealedResults(
  session: SessionRecord,
  question: Question,
): QuestionResults {
  const snapshot = snapshotFor(session, question.id);
  if (!snapshot) return tallyQuestion(session, question);

  return resultsFrom(
    question,
    (id) => ({
      count: snapshot.counts[id] ?? 0,
      room: snapshot.roomCounts?.[id] ?? 0,
      online: snapshot.onlineCounts?.[id] ?? 0,
    }),
    {
      total: snapshot.totalResponses,
      room: snapshot.roomResponses,
      online: snapshot.onlineResponses,
    },
    snapshot.revealedAt,
  );
}
