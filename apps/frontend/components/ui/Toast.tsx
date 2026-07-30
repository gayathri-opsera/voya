"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => {
      // Deduplicate by title
      if (prev.some((p) => p.title === t.title)) return prev;
      const next = [...prev, { ...t, id }];
      // Max 5 visible
      return next.slice(-5);
    });
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((p) => p.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast(): Pick<ToastContextValue, "addToast" | "removeToast"> {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return { addToast: ctx.addToast, removeToast: ctx.removeToast };
}

const variantClasses: Record<ToastVariant, string> = {
  default: "bg-white border-surface-muted text-text-primary",
  success: "bg-success-light border-success text-success",
  warning: "bg-warning-light border-warning text-warning",
  error:   "bg-error-light border-error text-error",
};

function ToastContainer() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 shadow-lg min-w-[280px] max-w-sm",
            variantClasses[t.variant ?? "default"],
          )}
        >
          <div className="flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs opacity-80">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => ctx.removeToast(t.id)}
            aria-label="Dismiss"
            className="text-lg leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
