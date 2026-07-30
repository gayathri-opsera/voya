"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-surface-muted text-text-secondary",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  error:   "bg-error-light text-error",
  info:    "bg-info-light text-info",
  outline: "border border-surface-muted text-text-secondary bg-transparent",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ variant = "default", className, children, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
