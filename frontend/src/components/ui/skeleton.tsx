import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md", className)}
      style={{ background: "var(--background-surface)", ...style }}
      {...props}
    />
  );
}

export { Skeleton };
