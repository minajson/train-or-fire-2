import { getQuestion, ROLES, verdictOptionId, type Verdict } from "@/lib/content/activity";
import type { BoardEntry, Phase, Placement, SessionRecord } from "@/lib/types";
import { revealedResults, snapshotFor } from "./tally";

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/**
 * The TRAIN/FIRE board — the visual record of the room's judgement.
 *
 * A role appears only once its own question has been revealed. Before that the
 * board simply has one fewer row, so the audience watches it build.
 *
 * The numbers come from the reveal snapshot, so a role that has been on the
 * wall keeps the exact result it was shown with — through Back, through Next,
 * through a reload, through a redeploy, and through the facilitator clearing
 * the rehearsal crowd. The only things that take a role back off the board are
 * the three that say so out loud: unlock, reset stage, restart.
 *
 * Two placements exist that are not a side, and both are deliberate:
 *
 *  - `split` — an exact tie. Assigning it to TRAIN would be inventing a verdict
 *    nobody voted for, in the one place where the room's own arithmetic is on
 *    screen next to it.
 *  - `pending` — revealed with nobody having voted. This is the state that used
 *    to render as "TRAIN 0% / FIRE 0%", which reads as a decision when it is
 *    the absence of one.
 */
export function buildBoard(session: SessionRecord): BoardEntry[] {
  const entries: BoardEntry[] = [];

  for (const role of ROLES) {
    const phase: Phase = session.phases[role.questionId] ?? "voting";
    if (phase !== "revealed") continue;

    const question = getQuestion(role.questionId);
    if (!question) continue;

    const results = revealedResults(session, question);
    const trainId = verdictOptionId(role.questionId, "train");
    const fireId = verdictOptionId(role.questionId, "fire");

    const trainCount = results.options.find((o) => o.optionId === trainId)?.count ?? 0;
    const fireCount = results.options.find((o) => o.optionId === fireId)?.count ?? 0;
    const total = trainCount + fireCount;

    const tie = total > 0 && trainCount === fireCount;
    const placement: Placement =
      total === 0 ? "pending" : tie ? "split" : fireCount > trainCount ? "fire" : "train";
    const verdict: Verdict | null =
      placement === "train" || placement === "fire" ? placement : null;
    const minorityCount =
      verdict === null ? Math.min(trainCount, fireCount) : verdict === "train" ? fireCount : trainCount;

    entries.push({
      roleId: role.id,
      title: role.title,
      quote: role.quote,
      facts: role.phoneFacts,
      placement,
      verdict,
      tie,
      hasVotes: total > 0,
      trainCount,
      fireCount,
      trainPct: pct(trainCount, total),
      firePct: pct(fireCount, total),
      total,
      minorityCount,
      minorityPct: pct(minorityCount, total),
      // Filled in below, once every revealed role is known.
      order: 0,
      revealedAt: results.revealedAt,
    });
  }

  /*
   * The order the ROOM decided them in, which is not always role order — a
   * facilitator can jump, and often does. The verdict wall enters each card in
   * this sequence, so what the audience watches replays their own session.
   */
  const revealedAt = new Map(
    entries.map((entry, i) => {
      const role = ROLES.find((r) => r.id === entry.roleId);
      const at = role ? (snapshotFor(session, role.questionId)?.revealedAt ?? null) : null;
      // A session predating snapshots has no timestamps; role order is the
      // only sequence available, and it is the one such a session ran in.
      return [entry.roleId, at ?? i] as const;
    }),
  );
  const sequence = [...entries].sort(
    (a, b) => (revealedAt.get(a.roleId) ?? 0) - (revealedAt.get(b.roleId) ?? 0),
  );
  sequence.forEach((entry, i) => {
    entry.order = i + 1;
  });

  return entries;
}
