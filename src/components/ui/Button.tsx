"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "solid" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-graphite disabled:bg-ink-3",
  outline: "bg-surface text-ink border border-rule hover:border-ink hover:bg-paper-2",
  ghost: "bg-transparent text-ink-2 hover:bg-paper-2 hover:text-ink",
  danger: "bg-fire text-white hover:bg-fire-deep",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[0.8rem]",
  md: "h-11 px-4 text-[0.9rem]",
  lg: "h-14 px-6 text-base",
};

export function Button({
  children,
  variant = "outline",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
