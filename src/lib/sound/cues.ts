/**
 * Sound cues.
 *
 * Every cue is synthesised in the browser, which keeps the app dependency-free
 * and guarantees the sounds stay short and quiet. The brief was explicit: this
 * must never feel like an arcade game. So there is no melody, no chime, no
 * fanfare — the palette is mechanical latches, low impacts and filtered air.
 *
 * To replace a cue with a recording, drop a file in `public/sounds/` and add
 * its path to SOUND_SOURCES. The manager prefers a file whenever one exists and
 * falls back to the synth otherwise, with no other code change.
 */

export type CueName =
  /** A phone joins the room. */
  | "join"
  /** Finger lands on a control. Barely audible on purpose. */
  | "tap"
  /** TRAIN chosen: a positive mechanical confirmation, like a latch seating. */
  | "train"
  /** FIRE chosen: a short low impact. A thud, never an explosion. */
  | "fire"
  /** Voting closed. */
  | "lock"
  /** Result opens on the projector. Subtle cinematic weight. */
  | "reveal"
  /** A role card settles into its box on the board. */
  | "settle"
  /** Moving between stages and beats. */
  | "advance"
  /** The machine fails. A controlled industrial shutdown. */
  | "failure"
  /** The last screen of the activity. */
  | "closing";

/** e.g. { reveal: "/sounds/reveal.mp3" } */
export const SOUND_SOURCES: Partial<Record<CueName, string>> = {};

/** Per-cue trim, so no single cue has to be re-recorded to sit right. */
export const CUE_GAIN: Record<CueName, number> = {
  join: 0.32,
  tap: 0.22,
  train: 0.42,
  fire: 0.5,
  lock: 0.34,
  reveal: 0.5,
  settle: 0.34,
  advance: 0.18,
  failure: 0.55,
  closing: 0.44,
};

export interface SynthCtx {
  ctx: AudioContext;
  out: AudioNode;
  now: number;
  noise: AudioBuffer;
}

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  start?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  /** Glide to this frequency across the note. */
  sweepTo?: number;
  filter?: { freq: number; q?: number; type?: BiquadFilterType };
  detune?: number;
}

export function tone(s: SynthCtx, o: ToneOptions) {
  const start = s.now + (o.start ?? 0);
  const dur = o.dur ?? 0.24;
  const attack = o.attack ?? 0.006;

  const osc = s.ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.detune) osc.detune.setValueAtTime(o.detune, start);
  if (o.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.sweepTo), start + dur);

  const gain = s.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.2), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let node: AudioNode = osc;
  if (o.filter) {
    const biquad = s.ctx.createBiquadFilter();
    biquad.type = o.filter.type ?? "lowpass";
    biquad.frequency.setValueAtTime(o.filter.freq, start);
    biquad.Q.setValueAtTime(o.filter.q ?? 0.7, start);
    node.connect(biquad);
    node = biquad;
  }
  node.connect(gain).connect(s.out);

  osc.start(start);
  osc.stop(start + dur + 0.05);
}

interface NoiseOptions {
  start?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  filter?: { freq: number; q?: number; type?: BiquadFilterType; sweepTo?: number };
}

export function noiseBurst(s: SynthCtx, o: NoiseOptions) {
  const start = s.now + (o.start ?? 0);
  const dur = o.dur ?? 0.12;

  const src = s.ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;

  const gain = s.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.15), start + (o.attack ?? 0.004));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let node: AudioNode = src;
  if (o.filter) {
    const biquad = s.ctx.createBiquadFilter();
    biquad.type = o.filter.type ?? "bandpass";
    biquad.frequency.setValueAtTime(o.filter.freq, start);
    biquad.Q.setValueAtTime(o.filter.q ?? 1, start);
    if (o.filter.sweepTo) {
      biquad.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.sweepTo), start + dur);
    }
    node.connect(biquad);
    node = biquad;
  }
  node.connect(gain).connect(s.out);

  src.start(start);
  src.stop(start + dur + 0.05);
}

export const RECIPES: Record<CueName, (s: SynthCtx) => void> = {
  join: (s) => {
    tone(s, { freq: 392, type: "sine", dur: 0.1, gain: 0.16, filter: { freq: 1800 } });
    tone(s, { freq: 587, type: "sine", start: 0.055, dur: 0.14, gain: 0.13, filter: { freq: 2200 } });
  },

  tap: (s) => {
    noiseBurst(s, { dur: 0.03, gain: 0.09, filter: { freq: 2600, q: 1.4 } });
  },

  /*
   * TRAIN. Two mechanical events a few milliseconds apart — the sound of a
   * component seating correctly. The pitch rises very slightly, which is what
   * makes it read as "confirmed" rather than merely "registered".
   */
  train: (s) => {
    noiseBurst(s, { dur: 0.035, gain: 0.14, filter: { freq: 2400, q: 1.2 } });
    tone(s, { freq: 220, type: "triangle", dur: 0.12, gain: 0.2, filter: { freq: 900 } });
    tone(s, {
      freq: 330,
      type: "triangle",
      start: 0.062,
      dur: 0.16,
      gain: 0.16,
      filter: { freq: 1400 },
    });
  },

  /*
   * FIRE. A single low impact with a short filtered tail. Deliberately not an
   * explosion, not a buzzer, and not a "wrong answer" sting — firing someone is
   * a decision with weight, not a mistake the app is scoring.
   */
  fire: (s) => {
    tone(s, { freq: 150, type: "sine", sweepTo: 52, dur: 0.3, gain: 0.34, attack: 0.003 });
    noiseBurst(s, { dur: 0.13, gain: 0.11, filter: { freq: 420, sweepTo: 120, q: 0.8 } });
  },

  lock: (s) => {
    noiseBurst(s, { dur: 0.04, gain: 0.12, filter: { freq: 1500, q: 2 } });
    tone(s, { freq: 174, type: "square", dur: 0.07, gain: 0.09, filter: { freq: 700 } });
  },

  /*
   * REVEAL. A sub-bass swell under a soft air lift. Felt more than heard —
   * enough to make a room look up, not enough to be a sound effect.
   */
  reveal: (s) => {
    tone(s, { freq: 74, type: "sine", dur: 0.85, gain: 0.3, attack: 0.09 });
    tone(s, { freq: 148, type: "sine", dur: 0.7, gain: 0.09, attack: 0.12 });
    noiseBurst(s, { dur: 0.5, gain: 0.05, attack: 0.16, filter: { freq: 700, sweepTo: 2600, q: 0.6 } });
  },

  settle: (s) => {
    noiseBurst(s, { dur: 0.05, gain: 0.1, filter: { freq: 900, q: 1.1 } });
    tone(s, { freq: 110, type: "sine", dur: 0.16, gain: 0.16, attack: 0.004 });
  },

  advance: (s) => {
    noiseBurst(s, { dur: 0.022, gain: 0.06, filter: { freq: 3200, q: 1.6 } });
  },

  /*
   * FAILURE. A controlled industrial shutdown: a machine spinning down, its
   * tone dropping and its air dying away. No alarm, no siren.
   */
  failure: (s) => {
    tone(s, { freq: 196, type: "sawtooth", sweepTo: 41, dur: 1.5, gain: 0.16, attack: 0.02, filter: { freq: 620, q: 0.9 } });
    tone(s, { freq: 98, type: "sine", sweepTo: 34, dur: 1.7, gain: 0.24, attack: 0.02 });
    noiseBurst(s, { dur: 1.4, gain: 0.08, attack: 0.03, filter: { freq: 900, sweepTo: 90, q: 0.7 } });
    noiseBurst(s, { start: 1.35, dur: 0.1, gain: 0.1, filter: { freq: 260, q: 1.2 } });
  },

  closing: (s) => {
    tone(s, { freq: 87, type: "sine", dur: 1.1, gain: 0.26, attack: 0.1 });
    tone(s, { freq: 261, type: "sine", start: 0.12, dur: 0.9, gain: 0.07, attack: 0.18 });
  },
};
