"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500 shadow-sm",
  secondary:
    "bg-surface-muted text-text-primary hover:bg-surface-subtle border border-surface-muted",
  ghost:
    "text-text-primary hover:bg-surface-subtle",
  destructive:
    "bg-error text-white hover:bg-red-800 focus-visible:ring-red-500 shadow-sm",
  outline:
    "border border-brand-500 text-brand-500 hover:bg-brand-50 focus-visible:ring-brand-500",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm rounded",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-6 text-base rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        aria-disabled={disabled ?? loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
