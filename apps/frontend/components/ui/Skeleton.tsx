"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  height?: string | number;
  width?: string | number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton({ variant = "text", height, width, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        aria-busy="true"
        aria-label="Loading…"
        className={cn(
          "animate-pulse bg-surface-muted",
          variant === "text"        && "h-4 w-full rounded",
          variant === "circular"    && "rounded-full",
          variant === "rectangular" && "rounded-md",
          className,
        )}
        style={{ height, width, ...style }}
        {...props}
      />
    );
  },
);
