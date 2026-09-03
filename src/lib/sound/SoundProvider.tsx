"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CueName } from "./cues";
import { getSoundManager } from "./manager";

interface SoundApi {
  play: (cue: CueName, throttleMs?: number) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  unlocked: boolean;
  unlock: () => void;
}

const SoundContext = createContext<SoundApi | null>(null);

/**
 * Wraps a surface in sound. The first pointer/key/touch anywhere on the page
 * unlocks the audio context — the browser requires a gesture, and asking a
 * participant to press "enable sound" before a session would be friction in
 * exactly the wrong place.
 */
export function SoundProvider({
  children,
  /** Facilitator's master switch, delivered over the session stream. */
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const manager = useMemo(() => getSoundManager(), []);
  const [muted, setMutedState] = useState(manager.isMuted);
  const [unlocked, setUnlocked] = useState(manager.isUnlocked);

  useEffect(
    () =>
      manager.subscribe(() => {
        setMutedState(manager.isMuted);
        setUnlocked(manager.isUnlocked);
      }),
    [manager],
  );

  useEffect(() => {
    const unlock = () => void manager.unlock();
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [manager]);

  const play = useCallback(
    (cue: CueName, throttleMs?: number) => {
      if (!enabled) return;
      manager.play(cue, throttleMs);
    },
    [manager, enabled],
  );

  const setMuted = useCallback((next: boolean) => manager.setMuted(next), [manager]);
  const unlock = useCallback(() => void manager.unlock(), [manager]);

  const value = useMemo<SoundApi>(
    () => ({ play, muted: muted || !enabled, setMuted, unlocked, unlock }),
    [play, muted, enabled, setMuted, unlocked, unlock],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundApi {
  const ctx = useContext(SoundContext);
  if (ctx) return ctx;
  // Sound is optional. A surface without a provider stays silent rather than
  // throwing.
  return { play: () => {}, muted: true, setMuted: () => {}, unlocked: false, unlock: () => {} };
}

/**
 * Fires `cue` when `value` changes and the predicate agrees — the common shape
 * for "play a sound when the phase becomes revealed".
 */
export function useCueOnChange<T>(
  value: T,
  cue: CueName,
  shouldPlay: (next: T, prev: T) => boolean,
) {
  const { play } = useSound();
  const previous = useRef(value);
  useEffect(() => {
    const prev = previous.current;
    previous.current = value;
    if (Object.is(prev, value)) return;
    if (shouldPlay(value, prev)) play(cue);
    // `shouldPlay` is deliberately not a dependency: callers pass an inline
    // predicate, and re-running on every render would double-fire cues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cue, play]);
}
