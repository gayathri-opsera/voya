"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-8 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <div aria-hidden className="text-text-muted">
          {icon}
        </div>
      )}
      <div>
        <p className="text-base font-medium text-text-primary">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
