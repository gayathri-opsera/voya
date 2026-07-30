"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "elevated";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  function Card({ variant = "default", className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl bg-white p-6",
          variant === "default"  && "shadow-sm",
          variant === "bordered" && "border border-surface-muted",
          variant === "elevated" && "shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("mb-4", className)} {...props} />;
  },
);

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return <h3 ref={ref} className={cn("text-lg font-semibold text-text-primary", className)} {...props} />;
  },
);

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("text-text-secondary", className)} {...props} />;
  },
);
