import { cn } from "@/lib/utils";

type Variant = "moderation" | "published" | "rejected" | "sell" | "buy" | "trade" | "default";

const styles: Record<Variant, string> = {
  moderation: "bg-warning/15 text-warning-foreground border-warning/30",
  published: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  sell: "bg-primary/10 text-primary border-primary/30",
  buy: "bg-slate-100 text-slate-800 border-slate-300",
  trade: "bg-amber-50 text-amber-800 border-amber-300",
  default: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ children, variant = "default", className }: { children: React.ReactNode; variant?: Variant; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", styles[variant], className)}>
      {children}
    </span>
  );
}
