"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils.js";

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "left" | "right";
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent({ side = "right", className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-full flex-col bg-white shadow-xl",
          "max-w-xs sm:max-w-sm",
          side === "right" ? "right-0" : "left-0",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "right"
            ? "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            : "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          className,
        )}
        {...props}
      >
        <DrawerClose
          aria-label="Close drawer"
          className="absolute right-4 top-4 z-10 rounded opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span aria-hidden className="text-lg">×</span>
        </DrawerClose>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent };
