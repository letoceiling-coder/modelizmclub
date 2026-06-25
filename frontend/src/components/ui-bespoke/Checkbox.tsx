import { Check } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-[8px] px-[12px] py-[8px] text-[13px] transition-colors"
      style={{
        background: checked ? "var(--accent-soft)" : "var(--background-elevated)",
        color: checked ? "var(--accent)" : "var(--foreground-70)",
        border: `1px solid ${checked ? "var(--border-accent)" : "var(--border)"}`,
        borderRadius: "var(--r-tag)",
        minHeight: 36,
      }}
    >
      <span
        className="grid h-[16px] w-[16px] place-items-center"
        style={{
          background: checked ? "var(--accent)" : "transparent",
          border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
          borderRadius: "4px",
          color: "#fff",
        }}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
