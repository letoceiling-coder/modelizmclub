import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * UI Kit 2.0 — underline-style tabs.
 * Scrollable on mobile (overflow-x-auto), no text clipping, 44px tap targets.
 * Active state: #627FFF (var(--accent)).
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Scrollable row, hidden scrollbar
      "flex w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      // Persistent bottom border — active trigger overlaps it with accent color
      "border-b border-[var(--border)] bg-transparent",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Layout — never shrink, never wrap, 44px tap target
      "relative inline-flex shrink-0 items-center justify-center gap-[6px]",
      "whitespace-nowrap px-4",
      "min-h-[44px] cursor-pointer",
      // Typography
      "text-[14px] font-medium",
      // Underline approach: -mb-px pulls the trigger's bottom border over the
      // list's border-b, so only the accent line is visible when active.
      "-mb-px border-b-2 border-transparent",
      // Colors
      "text-[var(--foreground-50)] transition-colors duration-150",
      // Hover
      "hover:text-[var(--foreground-70)]",
      // Active — accent underline + accent text
      "data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent)] data-[state=active]:font-semibold",
      // Focus
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm",
      // Disabled
      "disabled:pointer-events-none disabled:opacity-40",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
