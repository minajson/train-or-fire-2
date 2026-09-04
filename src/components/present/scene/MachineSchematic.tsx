"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { MACHINE_STEPS, type MachineCondition } from "@/lib/content/activity";
import { useMotionOff } from "@/lib/motion/primitives";
import { SignalPulse, WarningWave } from "./Industrial";

/**
 * The machine, drawn rather than described.
 *
 * A motor-driven pump package in elevation: skid, driver, coupling guard,
 * casing, bearing housing, suction and discharge. It is a simplification, not
 * an invention — every element on it exists on the equipment this session is
 * about, and it moves the way that equipment moves.
 *
 * That last constraint is the one that mattered most. The brief asked for
 * nothing physically impossible, and an audience of operations and maintenance
 * people will find the lie instantly. So:
 *
 *  - The shaft SLOWS slightly as the bearing degrades. It does not speed up,
 *    and it does not wobble visibly — a shaft you can see wobbling from the
 *    back of a room is a shaft that has already come apart.
 *  - Vibration shows up where it is actually observed: as amplitude on the
 *    trace, and as a small whole-body tremor of the skid. Millimetres, scaled.
 *  - Temperature rises monotonically except across the temporary fix, where it
 *    partially recovers. That dip is the whole point of the story.
 *  - The trip is a STOP. The machine comes to rest, the lamp latches red, and
 *    nothing explodes, because that is what a protection system doing its job
 *    looks like.
 */

const TONE: Record<MachineCondition, { line: string; lamp: "signal" | "fire" | "train"; label: string }> = {
  normal: { line: "var(--color-ink-2)", lamp: "train", label: "Normal" },
  watch: { line: "var(--color-ink-2)", lamp: "signal", label: "Watch" },
  warning: { line: "var(--color-signal)", lamp: "signal", label: "Warning" },
  critical: { line: "var(--color-fire)", lamp: "fire", label: "Critical" },
  failed: { line: "var(--color-fire)", lamp: "fire", label: "Tripped" },
};

export function MachineSchematic({
  /** Index into MACHINE_STEPS. Clamped, so an over-run beat cannot break it. */
  step,
  className,
  showReadout = true,
}: {
  step: number;
  className?: string;
  showReadout?: boolean;
}) {
  const reduced = useMotionOff();
  const state = MACHINE_STEPS[Math.max(0, Math.min(MACHINE_STEPS.length - 1, step))];
  const tone = TONE[state.condition];
  const failed = state.condition === "failed";
  const alarming = state.condition === "warning" || state.condition === "critical";

  // Rotation period in seconds. Slower shaft = longer period.
  const period = state.speed > 0 ? 1.6 / state.speed : 0;
  // Whole-body tremor, in viewBox units. Deliberately sub-pixel-ish at any
  // realistic projection size: felt, not watched.
  const shake = reduced || failed ? 0 : state.vibration * 1.6;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <svg
        viewBox="0 0 420 260"
        className="min-h-0 w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Machine condition: ${tone.label}. ${state.label}.`}
      >
        <motion.g
          animate={
            shake > 0
              ? { x: [0, shake, -shake * 0.7, shake * 0.4, 0], y: [0, -shake * 0.5, shake * 0.5, 0, 0] }
              : { x: 0, y: 0 }
          }
          transition={
            shake > 0
              ? { duration: 0.16, repeat: Infinity, ease: "linear" }
              : { duration: 0.4 }
          }
        >
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Foundation and skid — the datum everything else sits on. */}
            <line x1="18" y1="214" x2="402" y2="214" stroke="var(--color-rule)" strokeWidth="1" />
            <rect
              x="40"
              y="200"
              width="340"
              height="14"
              rx="2"
              stroke="var(--color-ink-2)"
              strokeWidth="1.5"
            />
            {[70, 130, 250, 340].map((x) => (
              <line
                key={x}
                x1={x}
                y1="214"
                x2={x}
                y2="224"
                stroke="var(--color-rule)"
                strokeWidth="1.5"
              />
            ))}

            {/* Driver, with cooling fins. */}
            <rect
              x="56"
              y="126"
              width="118"
              height="74"
              rx="4"
              stroke={tone.line}
              strokeWidth="1.5"
            />
            {[70, 84, 98, 112, 126, 140, 154].map((x) => (
              <line
                key={x}
                x1={x}
                y1="132"
                x2={x}
                y2="194"
                stroke="var(--color-rule)"
                strokeWidth="1"
              />
            ))}
            <rect
              x="74"
              y="112"
              width="36"
              height="14"
              rx="2"
              stroke="var(--color-ink-2)"
              strokeWidth="1.5"
            />

            {/* Coupling guard, and the shaft running through it. */}
            <rect
              x="182"
              y="146"
              width="42"
              height="34"
              rx="3"
              stroke="var(--color-ink-2)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <line x1="174" y1="163" x2="238" y2="163" stroke={tone.line} strokeWidth="2" />

            {/* Bearing housing — where the heat is. */}
            <rect
              x="238"
              y="150"
              width="26"
              height="26"
              rx="2"
              stroke={tone.line}
              strokeWidth="1.5"
            />

            {/* Casing. The impeller inside it is the only thing that rotates. */}
            <circle cx="308" cy="163" r="46" stroke={tone.line} strokeWidth="1.5" />
            <path d="M308 209 V200 H380 V200" stroke="var(--color-ink-2)" strokeWidth="1.5" />
            <motion.g
              style={{ originX: "308px", originY: "163px" }}
              animate={period > 0 && !reduced ? { rotate: 360 } : { rotate: 0 }}
              transition={
                period > 0 && !reduced
                  ? { duration: period, repeat: Infinity, ease: "linear" }
                  : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
              }
            >
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <line
                  key={deg}
                  x1="308"
                  y1="163"
                  x2={308 + 34 * Math.cos((deg * Math.PI) / 180)}
                  y2={163 + 34 * Math.sin((deg * Math.PI) / 180)}
                  stroke="var(--color-ink-3)"
                  strokeWidth="1.2"
                  opacity="0.55"
                />
              ))}
              <circle cx="308" cy="163" r="9" stroke={tone.line} strokeWidth="1.5" />
            </motion.g>

            {/* Suction and discharge. */}
            <path d="M354 163 H392 V64" stroke="var(--color-ink-2)" strokeWidth="1.5" />
            <path d="M308 117 V44 H214" stroke="var(--color-ink-2)" strokeWidth="1.5" />
            <circle cx="392" cy="100" r="7" stroke="var(--color-ink-2)" strokeWidth="1.5" />
            <line x1="386" y1="94" x2="398" y2="106" stroke="var(--color-ink-2)" strokeWidth="1.5" />

            {/* Bearing temperature, as a gauge beside the housing it reads. */}
            <g>
              <rect
                x="246"
                y="52"
                width="10"
                height="84"
                rx="5"
                stroke="var(--color-rule)"
                strokeWidth="1"
              />
              <motion.rect
                x="246"
                width="10"
                rx="5"
                fill={state.heat > 0.6 ? "var(--color-fire)" : "var(--color-signal)"}
                stroke="none"
                animate={{ y: 136 - state.heat * 84, height: state.heat * 84 }}
                transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                opacity={0.85}
              />
              <motion.line
                x1="240"
                x2="262"
                stroke={state.heat > 0.6 ? "var(--color-fire)" : "var(--color-signal)"}
                strokeWidth="2"
                animate={{ y1: 136 - state.heat * 84, y2: 136 - state.heat * 84 }}
                transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* Alarm setpoint. Fixed, so the marker can be seen crossing it. */}
              <line
                x1="242"
                y1="72"
                x2="260"
                y2="72"
                stroke="var(--color-ink-3)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </g>
          </g>
        </motion.g>

        {/* The trip. Latched, and drawn as a stop rather than as damage. */}
        {failed ? (
          <motion.g
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ originX: "210px", originY: "163px" }}
          >
            <rect
              x="230"
              y="128"
              width="156"
              height="70"
              rx="4"
              fill="none"
              stroke="var(--color-fire)"
              strokeWidth="2"
            />
            <line
              x1="230"
              y1="128"
              x2="386"
              y2="198"
              stroke="var(--color-fire)"
              strokeWidth="1.5"
              opacity="0.5"
            />
          </motion.g>
        ) : null}
      </svg>

      {showReadout ? (
        <div className="mt-[1.5cqh] shrink-0">
          <div className="flex items-center justify-between gap-[1.5cqw]">
            <span className="flex items-center gap-[0.8cqw]">
              <SignalPulse tone={tone.lamp} active={alarming || failed} size={12} />
              <span
                className={cn(
                  "stage-eyebrow",
                  failed || state.condition === "critical"
                    ? "text-fire"
                    : state.condition === "warning"
                      ? "text-signal"
                      : "text-ink-3",
                )}
              >
                {state.label}
              </span>
            </span>
            <span className="stage-eyebrow text-ink-3">Vibration</span>
          </div>

          <WarningWave
            amplitude={failed ? 0.03 : state.vibration}
            tone={state.condition === "critical" ? "fire" : state.condition === "warning" ? "signal" : "ink"}
            speed={failed ? 8 : 3.4 - state.vibration * 1.6}
            className="mt-[1.2cqh] h-[7cqh] w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
