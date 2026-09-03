import { ROLES, verdictOptionId, type Verdict } from "@/lib/content/activity";
import type { BoardEntry, Phase, SessionRecord } from "@/lib/types";
import { responsesFor } from "./tally";

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/**
 * The TRAIN/FIRE board — the visual record of the room's judgement.
 *
 * Derived on every read from the votes themselves rather than stored, which is
 * what makes the facilitator's Back button safe: navigating away from a
 * revealed role and returning cannot lose or duplicate its place on the board.
 *
 * A role appears only once its own question has been revealed. Before that the
 * board simply has one fewer row, so the audience watches it build.
 */
export function buildBoard(session: SessionRecord): BoardEntry[] {
  const entries: BoardEntry[] = [];

  for (const role of ROLES) {
    const phase: Phase = session.phases[role.questionId] ?? "voting";
    if (phase !== "revealed") continue;

    const responses = responsesFor(session, role.questionId);
    const trainId = verdictOptionId(role.questionId, "train");
    const fireId = verdictOptionId(role.questionId, "fire");

    const trainCount = responses.filter((r) => r.optionId === trainId).length;
    const fireCount = responses.filter((r) => r.optionId === fireId).length;
    const total = trainCount + fireCount;

    // An exact tie settles on TRAIN. Stated here rather than left implicit,
    // because a 50/50 room is a real outcome and the board must still resolve.
    const tie = total > 0 && trainCount === fireCount;
    const verdict: Verdict = fireCount > trainCount ? "fire" : "train";
    const minorityCount = verdict === "train" ? fireCount : trainCount;

    entries.push({
      roleId: role.id,
      title: role.title,
      quote: role.quote,
      verdict,
      tie,
      trainCount,
      fireCount,
      trainPct: pct(trainCount, total),
      firePct: pct(fireCount, total),
      total,
      minorityCount,
      minorityPct: pct(minorityCount, total),
    });
  }

  return entries;
}
