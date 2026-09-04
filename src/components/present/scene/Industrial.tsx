"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { useMotionOff } from "@/lib/motion/primitives";

/**
 * The shared 2D vocabulary: the small marks every scene in this activity is
 * drawn from.
 *
 * All of it is flat vector — SVG paths, strokes and a handful of transforms.
 * Nothing here reaches for WebGL, a canvas, or a particle system. The rules
 * that keep it feeling like instrumentation rather than decoration:
 *
 *  - Line first. Fills appear only where something is genuinely a solid
 *    object (a token, a status lamp), never as a gradient wash.
 *  - One stroke weight per depth. Structure is 1.5, detail is 1, the ghosted
 *    background layer is 1 at low opacity.
 *  - Colour is state, not styling. A red line means the machine has tripped.
 *    Amber means a warning is live. Nothing is tinted for atmosphere.
 *  - Every loop is slow enough to read and quiet enough to talk over. This
 *    runs behind a facilitator for forty minutes.
 */

/* ------------------------------------------------------------------ */
/* Signal pulse — "this is live"                                       */
/* ------------------------------------------------------------------ */

/**
 * A status lamp. Two rings expanding out of a solid centre, which is what a
 * beacon on a skid actually looks like from across a plant.
 */
export function SignalPulse({
  tone = "signal",
  size = 14,
  active = true,
  className,
}: {
  tone?: "signal" | "fire" | "train" | "ink";
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const reduced = useMotionOff();
  const colour = `var(--color-${tone === "ink" ? "ink-3" : tone})`;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {active && !reduced
        ? [0, 0.9].map((delay) => (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full"
              style={{ border: `1.5px solid ${colour}` }}
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
            />
          ))
        : null}
      <span
        className="absolute inset-[22%] rounded-full"
        style={{ background: colour, opacity: active ? 1 : 0.35 }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Warning wave — vibration, drawn honestly                            */
/* ------------------------------------------------------------------ */

/** One period of a vibration trace, at `amplitude` (0–1) of the half-height. */
function wavePath(width: number, height: number, amplitude: number, periods: number): string {
  const mid = height / 2;
  const a = Math.max(0.02, amplitude) * (height / 2 - 2);
  const step = width / (periods * 24);
  const points: string[] = [];

  for (let i = 0; i <= periods * 24; i += 1) {
    const x = i * step;
    const phase = (i / 24) * Math.PI * 2;
    /*
     * A pure sine reads as a test signal. Real rotating-equipment vibration
     * carries the 1× running speed plus a smaller second harmonic, and adding
     * that one extra term is the difference between "a wave" and "a trace off
     * a vibration probe" — the second is what an engineer in the room expects
     * to see.
     */
    const y = mid - a * (Math.sin(phase) * 0.82 + Math.sin(phase * 2.4) * 0.18);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

/**
 * A live vibration trace.
 *
 * Drawn twice, end to end, and translated by exactly one copy's width on an
 * infinite loop — so the waveform scrolls continuously with no seam and no
 * per-frame path regeneration. Amplitude is the only thing that changes as
 * the condition worsens, which keeps the deterioration legible: the room
 * watches the same trace get taller, not a different chart appear.
 */
export function WarningWave({
  amplitude,
  tone = "ink",
  speed = 2.6,
  className,
  width = 240,
  height = 56,
}: {
  /** 0–1. */
  amplitude: number;
  tone?: "signal" | "fire" | "train" | "ink";
  /** Seconds per scroll cycle. Lower is faster. */
  speed?: number;
  className?: string;
  width?: number;
  height?: number;
}) {
  const reduced = useMotionOff();
  const id = useId();
  const colour = tone === "ink" ? "var(--color-ink-2)" : `var(--color-${tone})`;
  const d = wavePath(width, height, amplitude, 4);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`wave-${id}`}>
          <rect x="0" y="0" width={width} height={height} />
        </clipPath>
      </defs>
      <line
        x1="0"
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="var(--color-rule)"
        strokeWidth="1"
      />
      <g clipPath={`url(#wave-${id})`}>
        <motion.g
          animate={reduced ? { x: 0 } : { x: [0, -width] }}
          transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
        >
          <path d={d} fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" />
          <g transform={`translate(${width} 0)`}>
            <path d={d} fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </motion.g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Risk marker — the intervention that was available                   */
/* ------------------------------------------------------------------ */

/**
 * "Opportunity to act", drawn as a break in the line rather than a badge.
 *
 * The point of the AAR is that every one of these was a place the chain could
 * have been cut, so the mark is a cut: a short perpendicular stroke across the
 * causal path, with the label beside it.
 */
export function RiskMarker({
  label,
  active = false,
  className,
}: {
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.6cqw] whitespace-nowrap",
        active ? "text-signal" : "text-ink-3",
        className,
      )}
    >
      <svg viewBox="0 0 14 18" className="h-[2.2cqh] w-auto shrink-0" aria-hidden="true">
        <line
          x1="7"
          y1="0"
          x2="7"
          y2="18"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.5}
          strokeDasharray="3 3"
          opacity={active ? 1 : 0.55}
        />
        <line x1="0" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      </svg>
      <span className="text-stage-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ambient linework                                                    */
/* ------------------------------------------------------------------ */

/**
 * The ghosted schematic that sits behind the title and join screens.
 *
 * Deliberately barely there. Its whole job is to stop a screen carrying three
 * words from reading as an empty template, and it fails that job the moment
 * anyone in the room looks at it instead of the words. So: hairlines at 5–8%
 * ink, one slow drift, nothing that blinks.
 */
export function AmbientLinework({
  className,
  intensity = 1,
}: {
  className?: string;
  intensity?: number;
}) {
  const reduced = useMotionOff();
  const o = (n: number) => n * intensity;

  return (
    <svg
      viewBox="0 0 800 500"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g stroke="var(--color-ink)" fill="none" strokeWidth="1">
        {/* Datum grid — the drawing sheet the machine is set out on. */}
        <g opacity={o(0.05)}>
          {[100, 200, 300, 400].map((y) => (
            <line key={y} x1="0" y1={y} x2="800" y2={y} />
          ))}
          {[160, 320, 480, 640].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="500" />
          ))}
        </g>

        {/* A pump/driver package in plan, reduced to its outline. */}
        <g opacity={o(0.09)} strokeWidth="1.5">
          <rect x="120" y="270" width="560" height="18" rx="2" />
          <rect x="170" y="180" width="190" height="90" rx="4" />
          <rect x="470" y="196" width="150" height="74" rx="4" />
          <circle cx="545" cy="233" r="46" />
          <circle cx="545" cy="233" r="18" />
          <line x1="360" y1="233" x2="470" y2="233" />
          <rect x="380" y="214" width="70" height="38" rx="3" />
          <path d="M620 233 H700 V120" />
          <path d="M545 187 V96 H430" />
        </g>

        {/*
         * One slow drift on the datum grid, so the sheet is alive without
         * being animated at. Deliberately NOT a second waveform: a screen
         * carrying a live vibration trace should carry exactly one, or the
         * trace stops meaning "this is the machine" and starts meaning
         * "decoration".
         */}
        <motion.g
          opacity={o(0.06)}
          animate={reduced ? { x: 0 } : { x: [0, -160] }}
          transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        >
          {[60, 440].map((y) => (
            <line key={y} x1="-200" y1={y} x2="1000" y2={y} strokeDasharray="2 22" />
          ))}
        </motion.g>
      </g>
    </svg>
  );
}
