"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils.js";

const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/bookings", label: "My Bookings" },
  { href: "/profile", label: "Profile" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-muted bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          <span aria-hidden>✈</span>
          <span>Voya</span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Main" className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-brand-50 text-brand-600"
                  : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth + locale area */}
        <div className="flex items-center gap-3">
          {/* Locale/currency placeholder */}
          <button
            aria-label="Change language or currency"
            className="hidden sm:flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary rounded px-2 py-1"
          >
            <span aria-hidden>🌐</span>
            <span>EN / USD</span>
          </button>
          <Link
            href="/auth/login"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
