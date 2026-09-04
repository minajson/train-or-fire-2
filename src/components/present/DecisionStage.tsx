"use client";

import { AnimatePresence, motion } from "framer-motion";
import { VerdictMark } from "@/components/ui/VerdictMark";
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
  highlight = false,
  countUp = true,
}: {
  verdict: Verdict;
  /** Share for the role being judged. Null until the facilitator reveals. */
  livePct: number | null;
  /** Roles already settled here, in the order the room decided them. */
  placed: BoardEntry[];
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
/* The decision stage                                                  */
/* ------------------------------------------------------------------ */

function minorityLine(entry: BoardEntry): string | null {
  if (!entry.hasVotes) return null;
  if (entry.tie) return "The room split exactly in half.";
  if (entry.minorityCount === 0) return "The room was unanimous.";
  if (entry.minorityCount === 1) return "1 person saw this differently.";
  return `${entry.minorityCount} people saw this differently.`;
}

const placementOf = (entry: BoardEntry | null): TokenPlacement => {
  if (!entry) return null;
  if (entry.placement === "train" || entry.placement === "fire") return entry.placement;
  if (entry.placement === "split") return "split";
  return null;
};

/**
 * The evidence, kept on screen for the whole decision.
 *
 * This is the second thing the brief asked for and the second thing that was
 * genuinely wrong: revisiting a decided role used to show a bare percentage
 * board, and a room cannot argue with a number when it can no longer see what
 * the number was about. Role, evidence, quote and result now travel together —
 * before the reveal, after it, and on every Back that returns here.
 */
function Evidence({ role, compact }: { role: Role; compact: boolean }) {
  return (
    <div className="min-w-0">
      <ul className={cn("space-y-[0.5cqh]", compact && "space-y-[0.2cqh]")}>
        {role.phoneFacts.map((fact) => (
          <li
            key={fact}
            className={cn(
              "display-loose text-ink-2",
              compact ? "text-stage-xs" : "text-stage-sm",
            )}
          >
            {fact}
          </li>
        ))}
      </ul>
      <p
        className={cn(
          "quote mt-[1.4cqh] text-ink",
          compact ? "text-stage-sm" : "text-stage-md",
        )}
      >
        &ldquo;{role.quote}&rdquo;
      </p>
    </div>
  );
}

export function DecisionStage({ state, role }: { state: PublicSessionState; role: Role }) {
  const revealed = state.phase === "revealed";
  const entry = state.board.find((b) => b.roleId === role.id) ?? null;
  const index = ROLES.findIndex((r) => r.id === role.id) + 1;
  const placement = placementOf(entry);

  /*
   * The running record of the room's verdicts — everyone EXCEPT the role on
   * screen. This role is already in the arena as a token; listing it again
   * underneath would put the same name on the wall twice, and two copies of a
   * thing read as clutter long before they read as reinforcement.
   */
  const trainPlaced = state.board.filter((b) => b.placement === "train" && b.roleId !== role.id);
  const firePlaced = state.board.filter((b) => b.placement === "fire" && b.roleId !== role.id);

  // Revealed with nobody having voted. Said in words, never as 0% / 0%.
  const noVotes = revealed && entry !== null && !entry.hasVotes;

  /*
   * Is this reveal happening now, or is this result coming back on screen?
   *
   * Only the first earns a count-up. On a Back into an already-decided role the
   * figures land on their real values immediately — sweeping them up from zero
   * again is precisely the "it fell back to 0%" the room reports, even when it
   * only lasts a second, because a second is long enough for someone to read
   * the wall and believe it.
   *
   * Answered from the snapshot's own timestamp against the server's clock, so
   * it needs no client state and cannot be confused by a reconnect or a
   * projector that was opened late.
   */
  const justRevealed =
    entry?.revealedAt != null && state.serverTime - entry.revealedAt < 4000;

  // One shared identity for the token, wherever on the screen it currently is.
  const tokenId = `token-${role.id}`;

  return (
    <StageFrame className="flex flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-[2cqw]">
        <span className="stage-eyebrow text-ink-3">
          Decision {String(index).padStart(2, "0")} / {String(ROLES.length).padStart(2, "0")}
        </span>
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="counter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-[1cqw]"
            >
              <SignalPulse tone="ink" size={11} active={state.status === "live"} />
              <span className="stage-eyebrow text-ink-3">Voting live</span>
              <span className="display text-stage-md text-ink-2 tnum">
                {state.counts.responses}
                <span className="text-ink-3"> / {state.counts.total}</span>
              </span>
              <span className="stage-eyebrow text-ink-3">Decided</span>
            </motion.div>
          ) : (
            <motion.div
              key="result-meta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="stage-eyebrow text-ink-3 tnum"
            >
              {entry?.hasVotes ? `${entry.total} decided` : "No votes"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/*
       * The role, and the evidence it is being judged on.
       *
       * The token is the name — there is exactly one of it on screen at any
       * moment. Before the reveal it sits here, at the head of its own
       * evidence. On reveal it LEAVES this block and reappears inside the zone
       * the room chose, and because both places share a layout id, Framer
       * flies the same object between them: the role visibly travels out of
       * the brief and into its verdict.
       *
       * The evidence stays put through all of it. Coming back to a decided
       * role has to show what the room was judging, not a bare percentage —
       * an audience cannot argue with a number whose subject has left.
       */}
      <div className="relative mt-[2cqh] flex shrink-0 items-start justify-between gap-[3cqw]">
        <div className="min-w-0 flex-1">
          {revealed ? null : (
            <TokenSlot layoutId={tokenId} marker={role.marker} title={role.title} size="lg" />
          )}
          <motion.div layout className={revealed ? "" : "mt-[1.6cqh]"}>
            <Evidence role={role} compact={revealed} />
          </motion.div>
        </div>

        <AnimatePresence>
          {revealed ? (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER, delay: 0.5 }}
              className="display-loose shrink-0 text-right text-stage-sm text-ink-3"
            >
              {noVotes ? "No votes yet" : entry ? minorityLine(entry) : null}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative mt-[2cqh] grid min-h-0 flex-1 grid-cols-2 gap-[2cqw]">
        <VerdictZone
          verdict="train"
          livePct={revealed && entry?.hasVotes ? entry.trainPct : null}
          countUp={justRevealed}
          placed={trainPlaced}
          highlight={revealed && entry?.placement === "train"}
        />
        <VerdictZone
          verdict="fire"
          livePct={revealed && entry?.hasVotes ? entry.firePct : null}
          countUp={justRevealed}
          placed={firePlaced}
          highlight={revealed && entry?.placement === "fire"}
        />

        {/*
         * The token rides above both zones, so its travel is one continuous
         * move across the arena rather than a hand-off between two boxes.
         */}
        <TokenArena
          layoutId={tokenId}
          marker={role.marker}
          title={role.title}
          placement={revealed ? placement : null}
        />

        {noVotes ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...ENTER, delay: 0.3 }}
            className="pointer-events-none absolute inset-x-0 bottom-[3cqh] z-30 flex justify-center"
          >
            <span className="stage-eyebrow rounded-full border border-rule bg-surface px-[1.6cqw] py-[0.9cqh] text-ink-2 shadow-lift">
              No votes yet
            </span>
          </motion.div>
        ) : null}
      </div>
    </StageFrame>
  );
}
