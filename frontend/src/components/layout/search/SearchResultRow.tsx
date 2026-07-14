import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function SearchGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="py-[6px]">
      <div
        className="flex items-center gap-[6px] px-[14px] py-[4px] text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--foreground-50)" }}
      >
        <Icon size={12} />
        {label}
      </div>
      {children}
    </div>
  );
}

export function ResultRow({
  to,
  params,
  avatar,
  fallbackIcon: FallbackIcon,
  title,
  subtitle,
  onNavigate,
}: {
  to: string;
  params?: Record<string, string>;
  avatar?: string;
  fallbackIcon: LucideIcon;
  title: string;
  subtitle?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      params={params}
      onClick={onNavigate}
      className="flex items-center gap-[10px] px-[14px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-[32px] w-[32px] shrink-0 rounded-full object-cover" />
      ) : (
        <div
          className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <FallbackIcon size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{title}</div>
        {subtitle && (
          <div className="truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</div>
        )}
      </div>
    </Link>
  );
}
