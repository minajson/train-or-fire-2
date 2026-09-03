import { cn } from "@/lib/cn";

/** The lockup, small. The projector's opening screen sets its own type. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display-loose text-[0.95rem] uppercase tracking-tight", className)}>
      Train <span className="text-ink-3">or</span> Fire
    </span>
  );
}
