import type { ConnectionState } from "@/lib/client/stream";
import { cn } from "@/lib/cn";

const LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  closed: "Disconnected",
};

const DOT: Record<ConnectionState, string> = {
  connecting: "bg-signal animate-breathe",
  live: "bg-train",
  reconnecting: "bg-signal animate-breathe",
  closed: "bg-fire",
};

export function ConnectionBadge({
  state,
  className,
}: {
  state: ConnectionState;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 eyebrow text-ink-3", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[state])} aria-hidden="true" />
      {LABEL[state]}
    </span>
  );
}
