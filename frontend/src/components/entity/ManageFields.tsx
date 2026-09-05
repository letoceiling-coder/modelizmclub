import type { ReactNode } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputStyle } from "@/components/entity/manageStyles";

/**
 * Кирпичи панели настроек: раздел, поле с подписью, кнопка сохранения,
 * опасная зона.
 *
 * Набор полей у сообщества и канала разный по существу — у одного категория
 * и заявки на вступление, у другого тип канала и комментарии, — и сводить их
 * в одну схему значило бы описывать форму данными. Общее здесь другое:
 * рамка, отступы, размеры шрифтов, счётчик символов. Он и вынесен.
 */

export function ManageSection({
  title,
  divided = true,
  children,
}: {
  title: string;
  /** Первый раздел идёт без верхней черты. */
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={divided ? "space-y-4 border-t pt-5" : "space-y-4"}
      style={divided ? { borderColor: "var(--border)" } : undefined}
    >
      <h3
        className="text-[13px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--foreground-50)" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Подпись поля. Со счётчиком, когда есть предел длины: раньше счётчик у
 * сообщества стоял в одну строку с подписью, а у канала — под полем.
 * Оставлен вариант сообщества: предел виден до того, как в него упрутся.
 */
export function FieldLabel({ text, length, max }: { text: string; length?: number; max?: number }) {
  if (max === undefined || length === undefined) {
    return (
      <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
        {text}
      </span>
    );
  }

  return (
    <span
      className="flex items-center justify-between text-[13px] font-medium"
      style={{ color: "var(--foreground-70)" }}
    >
      <span>{text}</span>
      <span
        className="font-mono text-[11px] tabular-nums"
        style={{ color: "var(--foreground-30)" }}
      >
        {length}/{max}
      </span>
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel text={label} length={max === undefined ? undefined : value.length} max={max} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
        style={inputStyle}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  max,
  rows,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  rows: number;
  /** Минимальная высота в px — у описания она больше, чем у правил. */
  minHeight: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel text={label} length={max === undefined ? undefined : value.length} max={max} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        rows={rows}
        className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y break-words"
        style={{ ...inputStyle, minHeight }}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel text={label} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
        style={inputStyle}
      >
        {children}
      </select>
    </label>
  );
}

export function SaveButton({
  disabled,
  busy,
  label,
  busyLabel,
  onClick,
}: {
  disabled: boolean;
  busy: boolean;
  label: string;
  busyLabel: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[12px] gap-2 sm:w-auto"
    >
      <Save size={16} />
      {busy ? busyLabel : label}
    </Button>
  );
}

export function DangerZone({
  title,
  warning,
  children,
}: {
  title: string;
  warning: string;
  children: ReactNode;
}) {
  return (
    <ManageSection title={title}>
      <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
        {warning}
      </p>
      {children}
    </ManageSection>
  );
}
