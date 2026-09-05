"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { hasShownReveal, markRevealShown, revealKey } from "@/lib/client/reveal-seen";
import { cn } from "@/lib/cn";
import { ROLES, type Role, type Verdict } from "@/lib/content/activity";
import { CountPct, ENTER, useMotionOff } from "@/lib/motion/primitives";
import type { BoardEntry, PublicSessionState } from "@/lib/types";
import { SignalPulse } from "./scene/Industrial";
import { TokenArena, TokenSlot, type TokenPlacement } from "./scene/RoleToken";
import { StageFrame } from "./StageFrame";

/* ------------------------------------------------------------------ */
/* Destination zones                                                   */
/* ------------------------------------------------------------------ */

const TONE: Record<Verdict, { label: string; wash: string; edge: string; ink: string }> = {
  train: { label: "Train", wash: "bg-train-wash", edge: "border-train-edge", ink: "text-train" },
  fire: { label: "Fire", wash: "bg-fire-wash", edge: "border-fire-edge", ink: "text-fire" },
};

/**
 * The directional field of a zone: where this decision sends someone.
 *
 * TRAIN draws rising guides — capability going up, inside the system. FIRE
 * draws lateral guides running off the right edge — out of the system
 * altogether. No train, no flames: the two literal readings the brief ruled
 * out, and both would have been jokes on a wall this session takes seriously.
 */
function ZoneField({ verdict, active }: { verdict: Verdict; active: boolean }) {
  const reduced = useMotionOff();
  const train = verdict === "train";
  const colour = train ? "var(--color-train)" : "var(--color-fire)";

  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/*
       * The guides occupy the middle band only.
       *
       * The top of a zone belongs to the word and the percentage; the bottom
       * belongs to the roles already placed there. A guide line running behind
       * either is not atmosphere — it is a number, or a name, that is harder to
       * read from the back of the room. So the field draws in the gap between
       * them, where the token travels.
       *
       * No arrowhead and no cross: the verdict mark beside the word already
       * says up and out, and a second one is the same statement twice.
       */}
      <g stroke={colour} fill="none" strokeWidth="1.2" opacity={active ? 0.24 : 0.11}>
        {[0, 1, 2, 3].map((i) =>
          train ? (
            <motion.path
              key={i}
              d={`M${28 + i * 48} 172 L${28 + i * 48} 96`}
              strokeDasharray="10 12"
              animate={reduced ? {} : { strokeDashoffset: [0, -44] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear", delay: i * 0.35 }}
            />
          ) : (
            <motion.path
              key={i}
              d={`M18 ${96 + i * 18} L200 ${96 + i * 18}`}
              strokeDasharray="10 12"
              animate={reduced ? {} : { strokeDashoffset: [0, -44] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear", delay: i * 0.35 }}
            />
          ),
        )}
      </g>
    </svg>
  );
}

/**
 * One half of the decision arena.
 *
 * Built as a place rather than a control: a large tinted field with a settled
 * edge and its own directional motion, which roles arrive in and stay in.
 * Nothing about it invites a click, because nobody clicks the projector — the
 * room votes on phones and this is where the answer lands.
 */
function VerdictZone({
  verdict,
  livePct,
  placed,
  subject,
  highlight = false,
  countUp = true,
}: {
  verdict: Verdict;
  /** Share for the role being judged. Null until the facilitator reveals. */
  livePct: number | null;
  /** Roles already settled here, in the order the room decided them. */
  placed: BoardEntry[];
  /**
   * The role this screen is about, once the room has sent it here.
   *
   * A structural slot rather than an overlay. Floating the token over the zone
   * put it on top of the percentage on a 768px-tall projector — the two things
   * the audience most needs to read, in the same place. Giving it a row of its
   * own means the zone reads down in the order the room thinks: the side, the
   * share, who it applies to, and then everyone else already standing here.
   */
  subject?: ReactNode;
  highlight?: boolean;
  /** False when this result is being re-shown rather than revealed. */
  countUp?: boolean;
}) {
  const tone = TONE[verdict];

  return (
    <motion.div
      animate={{ scale: highlight ? 1 : 0.995 }}
      transition={ENTER}
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 px-[3cqw] py-[3cqh]",
        tone.wash,
        highlight ? "border-current shadow-lift" : tone.edge,
        highlight && tone.ink,
      )}
    >
      <ZoneField verdict={verdict} active={highlight} />

      <div className={cn("relative flex shrink-0 items-center gap-[1.4cqw]", tone.ink)}>
        <VerdictMark verdict={verdict} className="h-[6cqh] w-[6cqh]" strokeWidth={2.6} />
        <span className="display text-stage-lg uppercase">{tone.label}</span>
      </div>

      {/*
       * The number gets its own line rather than sharing one with the word.
       * Side by side, a 100px figure and a 45px word fight for the same
       * baseline and the percent sign runs off the edge of the zone.
       *
       * And it is absent, not zero, until there is something to show. A wall
       * that says "0%" before anyone has voted is a wall telling the room it
       * decided nothing — which is exactly the misreading this release exists
       * to remove.
       */}
      {livePct !== null ? (
        <CountPct
          value={livePct}
          enabled={countUp}
          className={cn(
            "display relative mt-[1.5cqh] shrink-0 text-stage-2xl leading-[0.85] tnum",
            tone.ink,
          )}
        />
      ) : null}

      {/*
       * During the judging, roles stack up from the floor of the zone — the way
       * things settle into a container, and the way the board fills as the
       * activity runs. On the verdict screen the zones hold nothing else, so
       * the same list takes the centre and the room's judgement is the subject.
       */}
      {subject ? <div className="relative mt-[2cqh] shrink-0">{subject}</div> : null}

      <div className="relative mt-[2.5cqh] flex min-h-0 flex-1 flex-col justify-end">
        <ul className="flex flex-col gap-[1.8cqh]">
          <AnimatePresence initial={false}>
            {placed.map((entry) => (
              <motion.li
                key={entry.roleId}
                layout
                initial={{ opacity: 0, y: -34, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={ENTER}
                className="flex items-baseline justify-between gap-[1.5cqw] border-t border-current/15 pt-[1.6cqh]"
              >
                <span className="display-loose min-w-0 truncate text-stage-sm">
                  {entry.title}
                </span>
                <span className={cn("display text-stage-sm tnum", tone.ink)}>
                  {Math.round(verdict === "train" ? entry.trainPct : entry.firePct)}%
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* The decision, as one object                                         */
/* ------------------------------------------------------------------ */

/**
 * Everything the decision screen renders, resolved in one place.
 *
 * This exists because of a real failure: the screen used to decide, in several
 * separate places at render time, whether to show a title, whether to show
 * evidence, and whether to show percentages — each from a slightly different
 * input. A revisited role could therefore come back as evidence and numbers
 * with no name above them, which is the one thing a projected decision must
 * never be. A percentage without a role is not a result; it is a number the
 * room cannot argue with.
 *
 * So there is one function, it is pure, and every part of the screen reads its
 * output. Two sources feed it and nothing else:
 *
 *   IDENTITY — role, marker, facts, quote — comes from the activity script,
 *   via the stage's own `roleId`. It is a constant. It cannot be missing, it
 *   cannot arrive late, and it does not depend on the phase, the beat, the
 *   board, an animation, or anything the client is holding.
 *
 *   RESULT — the split, the placement — comes from the frozen snapshot on the
 *   board entry, and only ever when the question is revealed.
 *
 * Identity is therefore never conditional on the result being there. That
 * asymmetry is the whole fix.
 */
export interface DecisionView {
  index: number;
  count: number;
  marker: string;
  title: string;
  facts: string[];
  quote: string;
  revealed: boolean;
  /** True once revealed with at least one vote behind it. */
  hasResult: boolean;
  /** Null unless there is a real result. Never 0 standing in for "none". */
  trainPct: number | null;
  firePct: number | null;
  total: number;
  placement: TokenPlacement;
  /** Identifies this reveal for the "have we shown it yet" register. */
  revealKey: string | null;
  /** When the result was frozen. Null until there is one. */
  revealedAt: number | null;
  minorityLine: string | null;
}

export function decisionView(state: PublicSessionState, role: Role): DecisionView {
  const revealed = state.phase === "revealed";
  const entry = state.board.find((b) => b.roleId === role.id) ?? null;
  // A board entry only exists once the question is revealed, but be explicit:
  // a result is never read unless the phase says the room has been shown one.
  const result = revealed ? entry : null;
  const hasResult = Boolean(result?.hasVotes);

  return {
    index: ROLES.findIndex((r) => r.id === role.id) + 1,
    count: ROLES.length,
    marker: role.marker,
    title: role.title,
    facts: role.phoneFacts,
    quote: role.quote,
    revealed,
    hasResult,
    trainPct: hasResult ? (result?.trainPct ?? null) : null,
    firePct: hasResult ? (result?.firePct ?? null) : null,
    total: result?.total ?? 0,
    placement: hasResult ? placementOf(result) : null,
    revealKey: result ? revealKey(role.id, result.revealedAt) : null,
    revealedAt: result?.revealedAt ?? null,
    minorityLine: result && result.hasVotes ? minorityLine(result) : null,
  };
}

function minorityLine(entry: BoardEntry): string | null {
  if (!entry.hasVotes) return null;
  if (entry.tie) return "The room split exactly in half.";
  if (entry.minorityCount === 0) return "The room was unanimous.";
  if (entry.minorityCount === 1) return "1 person saw this differently.";
  return `${entry.minorityCount} people saw this differently.`;
}

function placementOf(entry: BoardEntry | null): TokenPlacement {
  if (!entry || !entry.hasVotes) return null;
  if (entry.placement === "train" || entry.placement === "fire") return entry.placement;
  if (entry.placement === "split") return "split";
  return null;
}

/* ------------------------------------------------------------------ */
/* Reveal, once                                                        */
/* ------------------------------------------------------------------ */

/**
 * True only on the showing of a reveal this page has not shown before.
 *
 * Two conditions, and both are needed. The register says whether this exact
 * reveal has already been on this projector — which is what makes a Back into
 * a role decided ten seconds ago correctly silent. The clock covers the one
 * case the register cannot: a page that has just loaded has shown nothing, so
 * without it every reload would replay every result it landed on.
 */
function useFirstShowing(key: string | null, serverTime: number, revealedAt: number | null) {
  const recent = revealedAt != null && serverTime - revealedAt < FRESH_MS;

  const [tracked, setTracked] = useState<{ key: string | null; fresh: boolean }>({
    key: null,
    fresh: false,
  });
  // React's sanctioned adjust-during-render: the answer has to be settled
  // before this frame paints, or the first frame of a reveal renders as a
  // revisit and the animation never starts.
  if (tracked.key !== key) {
    setTracked({ key, fresh: key !== null && recent && !hasShownReveal(key) });
  }

  useEffect(() => {
    if (key) markRevealShown(key);
  }, [key]);

  return tracked.key === key && tracked.fresh;
}

/** How long after a reveal a fresh page load still treats it as the moment. */
const FRESH_MS = 8000;

/* ------------------------------------------------------------------ */
/* The decision stage                                                  */
/* ------------------------------------------------------------------ */

/**
 * Who we are looking at, and what they did.
 *
 * Rendered identically whether the room is voting or the result is on the
 * wall. Nothing in this block is conditional on the phase — that is the point.
 * A facilitator pressing Back cannot land on a version of this screen that has
 * lost the name, because there is no version of this screen without it.
 *
 * The title is set at the same size as TRAIN and FIRE. From the back of a room
 * the question the audience asks on a returning screen is "who is this?", and
 * it has to be answerable before "what did we decide?".
 */
function RoleBrief({ view }: { view: DecisionView }) {
  return (
    <div className="min-w-0">
      <h2 className="display text-stage-lg leading-[0.95]">{view.title}</h2>
      <ul className="mt-[1.4cqh] space-y-[0.35cqh]">
        {view.facts.map((fact) => (
          <li key={fact} className="display-loose text-stage-sm text-ink-2">
            {fact}
          </li>
        ))}
      </ul>
      <p className="quote mt-[1.2cqh] text-stage-md text-ink">&ldquo;{view.quote}&rdquo;</p>
    </div>
  );
}

export function DecisionStage({ state, role }: { state: PublicSessionState; role: Role }) {
  const view = decisionView(state, role);
  const firstShowing = useFirstShowing(view.revealKey, state.serverTime, view.revealedAt);

  /*
   * The running record of the room's verdicts — everyone EXCEPT the role on
   * screen, whose own token is standing in one of these zones already.
   */
  const trainPlaced = state.board.filter((b) => b.placement === "train" && b.roleId !== role.id);
  const firePlaced = state.board.filter((b) => b.placement === "fire" && b.roleId !== role.id);

  // Revealed with nobody having voted. Said in words, never as 0% / 0%.
  const noVotes = view.revealed && !view.hasResult;

  const tokenId = `token-${role.id}`;
  const token = (
    <TokenSlot
      layoutId={tokenId}
      animate={firstShowing}
      marker={view.marker}
      title={view.title}
      verdict={view.placement === "train" || view.placement === "fire" ? view.placement : null}
    />
  );

  return (
    <StageFrame className="flex flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <span className="stage-eyebrow text-ink-3">
          Decision {String(view.index).padStart(2, "0")} /{" "}
          {String(view.count).padStart(2, "0")}
        </span>
        {!view.revealed ? (
          <span className="flex items-center gap-[1cqw]">
            <SignalPulse tone="ink" size={11} active={state.status === "live"} />
            <span className="stage-eyebrow text-ink-3">Voting live</span>
            <span className="display text-stage-md text-ink-2 tnum">
              {state.counts.responses}
              <span className="text-ink-3"> / {state.counts.total}</span>
            </span>
            <span className="stage-eyebrow text-ink-3">Decided</span>
          </span>
        ) : (
          <span className="stage-eyebrow text-ink-3 tnum">
            {view.hasResult ? `${view.total} decided` : "No votes"}
          </span>
        )}
      </div>

      {/*
       * Identity and evidence: the same DOM in both phases, so revealing
       * changes nothing here and returning cannot rebuild it wrongly. The only
       * thing that arrives on reveal is the sentence about the minority, and
       * it arrives BESIDE the brief rather than in place of any of it.
       */}
      <div className="relative mt-[2.5cqh] flex shrink-0 items-start justify-between gap-[3cqw]">
        <RoleBrief view={view} />

        <AnimatePresence>
          {view.revealed ? (
            <motion.p
              key="minority"
              initial={{ opacity: 0, y: firstShowing ? 12 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER, delay: firstShowing ? 0.5 : 0 }}
              className="display-loose shrink-0 text-right text-stage-sm text-ink-3"
            >
              {noVotes ? "Nobody voted on this decision." : view.minorityLine}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative mt-[2.5cqh] grid min-h-0 flex-1 grid-cols-2 gap-[2cqw]">
        <VerdictZone
          verdict="train"
          livePct={view.trainPct}
          countUp={firstShowing}
          placed={trainPlaced}
          subject={view.placement === "train" ? token : undefined}
          highlight={view.placement === "train"}
        />
        <VerdictZone
          verdict="fire"
          livePct={view.firePct}
          countUp={firstShowing}
          placed={firePlaced}
          subject={view.placement === "fire" ? token : undefined}
          highlight={view.placement === "fire"}
        />

        {/*
         * Before the room has decided — and on a tie, where it never will — the
         * token stands in the middle of the arena, belonging to neither side.
         * Once it has a side it lives inside that zone instead, and because
         * both places share a layout id the reveal is one continuous move
         * across the wall rather than a hand-off between two boxes.
         *
         * That move happens on the showing of a reveal and never again. On a
         * revisit the token is simply drawn where it belongs, already settled:
         * there is no flight to be caught halfway through, and so no frame in
         * which the arena holds a role that is not yet anywhere.
         */}
        {view.placement === "train" || view.placement === "fire" ? null : (
          <TokenArena
            layoutId={tokenId}
            animate={!view.revealed || firstShowing}
            marker={view.marker}
            title={view.title}
            placement={view.placement}
          />
        )}
      </div>
    </StageFrame>
  );
}
