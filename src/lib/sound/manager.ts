"use client";

import { CUE_GAIN, RECIPES, SOUND_SOURCES, type CueName, type SynthCtx } from "./cues";

const STORAGE_KEY = "train-or-fire:sound";

/**
 * Central sound manager.
 *
 * Nothing is created until the first real user gesture, so the browser's
 * autoplay policy is respected rather than worked around: before that, `play`
 * is a no-op that costs nothing. Volume and mute live here, so one facilitator
 * toggle silences the whole app.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private buffers = new Map<CueName, AudioBuffer>();
  private muted = false;
  private volume = 0.7;
  private unlocked = false;
  private lastPlayed = new Map<CueName, number>();
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === "muted") this.muted = true;
      } catch {
        /* storage disabled — default to audible */
      }
    }
  }

  get isMuted() {
    return this.muted;
  }

  get isUnlocked() {
    return this.unlocked;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  /** Call from a click/keydown/touch handler. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume().catch(() => {});
    }
    if (this.ctx.state === "running" && !this.unlocked) {
      this.unlocked = true;
      this.emit();
      void this.preload();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, muted ? "muted" : "on");
      } catch {
        /* ignore */
      }
    }
    if (this.master && this.ctx) {
      // Ramp rather than jump, so muting mid-cue does not click.
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, now, 0.02);
    }
    this.emit();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  /**
   * @param throttleMs Collapses repeats. Thirty phones confirming at once
   *        should sound like a handful of latches, not a hailstorm.
   */
  play(cue: CueName, throttleMs = 0) {
    if (this.muted || !this.unlocked || !this.ctx || !this.master || !this.noise) return;
    if (throttleMs > 0) {
      const last = this.lastPlayed.get(cue) ?? 0;
      const now = performance.now();
      if (now - last < throttleMs) return;
      this.lastPlayed.set(cue, now);
    }

    const trim = this.ctx.createGain();
    trim.gain.value = CUE_GAIN[cue] ?? 0.4;
    trim.connect(this.master);

    const sampled = this.buffers.get(cue);
    if (sampled) {
      const src = this.ctx.createBufferSource();
      src.buffer = sampled;
      src.connect(trim);
      src.start();
      return;
    }

    const synth: SynthCtx = {
      ctx: this.ctx,
      out: trim,
      now: this.ctx.currentTime,
      noise: this.noise,
    };
    try {
      RECIPES[cue]?.(synth);
    } catch {
      // A failed cue must never interrupt the session.
    }
  }

  /** Loads any recorded overrides declared in SOUND_SOURCES. */
  private async preload() {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      Object.entries(SOUND_SOURCES).map(async ([name, url]) => {
        try {
          const res = await fetch(url as string);
          const data = await res.arrayBuffer();
          this.buffers.set(name as CueName, await ctx.decodeAudioData(data));
        } catch {
          // Fall back to the synthesised cue.
        }
      }),
    );
  }

  /** One second of white noise, reused by every noise-based cue. */
  private makeNoise(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

declare global {
  var __trainOrFireSound: SoundManager | undefined;
}

export function getSoundManager(): SoundManager {
  globalThis.__trainOrFireSound ??= new SoundManager();
  return globalThis.__trainOrFireSound;
}
