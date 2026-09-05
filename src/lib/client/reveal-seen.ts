"use client";

/**
 * Which reveals this browser session has already put on screen.
 *
 * The reveal animation belongs to the EVENT, not to the screen. A token flying
 * into its zone and a percentage counting up are how a room is told "the answer
 * is in" — and replaying them every time the facilitator navigates back to a
 * decided role tells the room the answer is coming in again. Worse, mid-flight
 * the wall reads a number that is not the result and a token that is not yet
 * anywhere, which is exactly the "the role vanished / the percentages fell
 * back" a facilitator sees.
 *
 * A wall clock cannot answer this on its own. "Was this revealed recently?"
 * says nothing about whether THIS projector has shown it: a facilitator can
 * reveal, press Next, and press Back inside two seconds, and that is a revisit,
 * not a reveal. So the authority is a register of what this page has actually
 * displayed, keyed by the reveal's own identity — the role plus the instant it
 * was frozen. A re-reveal after unlocking gets a new timestamp and is therefore
 * a new event, correctly.
 *
 * Module scope is deliberate. This has to outlive the stage component, which
 * unmounts and remounts on every Back and Next, and it has to die with the page
 * — a fresh load genuinely has not shown anything yet. Both of those are what
 * module scope means.
 */
const shown = new Set<string>();

/** `${roleId}:${revealedAt}` — null when there is nothing frozen to identify. */
export function revealKey(roleId: string, revealedAt: number | null | undefined): string | null {
  return revealedAt == null ? null : `${roleId}:${revealedAt}`;
}

export function hasShownReveal(key: string): boolean {
  return shown.has(key);
}

export function markRevealShown(key: string): void {
  shown.add(key);
}
