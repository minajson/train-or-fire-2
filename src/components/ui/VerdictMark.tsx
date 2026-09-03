import type { Verdict } from "@/lib/content/activity";
import { cn } from "@/lib/cn";

/**
 * The shape half of the TRAIN/FIRE pair.
 *
 * Colour alone can never carry this decision — roughly one in twelve men has a
 * red/green deficiency, and this runs on a projector in a lit room. So every
 * place the two appear, they appear with a distinct silhouette as well as a
 * distinct colour and the word itself:
 *
 *   TRAIN — an upward chevron. Something being raised.
 *   FIRE  — a cross. Something being struck out.
 */
export function VerdictMark({
  verdict,
  className,
  strokeWidth = 2.4,
}: {
  verdict: Verdict;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      {verdict === "train" ? (
        <>
          <path
            d="M12 20V5"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="square"
          />
          <path
            d="M5 12l7-7 7 7"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </>
      ) : (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="square"
        />
      )}
    </svg>
  );
}
