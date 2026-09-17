import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";

/**
 * «Показывать мой номер» — выбор продавца, по умолчанию включён. Один на
 * мастер подачи и на панель владельца объявления.
 */
export function ShowPhoneSwitch({
  checked,
  onChange,
  disabled,
  note,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Дополнительная строка — например, что номер не подтверждён. */
  note?: string;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div
      className="flex items-start justify-between gap-3 rounded-[var(--r-input)] border p-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block text-[14px] font-medium"
          style={{ color: "var(--foreground)" }}
        >
          {t("pages.adDetail.showPhoneLabel")}
        </label>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adDetail.showPhoneHint")}
          {note ? ` ${note}` : null}
        </p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
