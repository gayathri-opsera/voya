"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "../ui/Drawer.js";
import { cn } from "../../lib/utils.js";

const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/bookings", label: "My Bookings" },
  { href: "/profile", label: "Profile" },
];

export function MobileNavDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        className="md:hidden rounded-md p-2 text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <span aria-hidden className="block h-5 w-5 text-lg">☰</span>
      </DrawerTrigger>
      <DrawerContent side="left" aria-label="Navigation">
        <div className="flex flex-col p-6 gap-2 mt-12">
          {NAV_LINKS.map((link) => (
            <DrawerClose key={link.href} asChild>
              <Link
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "rounded-md px-4 py-3 text-base font-medium transition-colors",
                  pathname === link.href
                    ? "bg-brand-50 text-brand-600"
                    : "text-text-primary hover:bg-surface-subtle",
                )}
              >
                {link.label}
              </Link>
            </DrawerClose>
          ))}
          <div className="mt-4 border-t border-surface-muted pt-4">
            <DrawerClose asChild>
              <Link
                href="/auth/login"
                className="block rounded-md bg-brand-500 px-4 py-3 text-center text-base font-medium text-white hover:bg-brand-600"
              >
                Sign in
              </Link>
            </DrawerClose>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
