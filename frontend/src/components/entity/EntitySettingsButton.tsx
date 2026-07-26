import { Settings } from "lucide-react";

interface Props {
  onClick: () => void;
  title: string;
}

export function EntitySettingsButton({ onClick, title }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors hover:bg-[var(--background-surface)]"
      style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
    >
      <Settings size={18} />
    </button>
  );
}
