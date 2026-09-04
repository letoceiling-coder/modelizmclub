import { useTranslation } from "react-i18next";
import {
  SCHEDULE_TIMEZONES,
  type PublishMode,
  defaultScheduleDateTime,
  defaultScheduleTimezone,
  minScheduleDateInput,
} from "@/lib/post-schedule";

interface Props {
  mode: PublishMode;
  onModeChange: (mode: PublishMode) => void;
  date: string;
  time: string;
  timezone: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onTimezoneChange: (timezone: string) => void;
  disabled?: boolean;
}

export function PostSchedulePicker({
  mode,
  onModeChange,
  date,
  time,
  timezone,
  onDateChange,
  onTimeChange,
  onTimezoneChange,
  disabled,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-[12px]">
      <div className="flex flex-wrap gap-[8px]">
        {(["now", "schedule"] as const).map((id) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(id)}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-[var(--r-pill)] border px-[14px] py-[9px] text-[14px] font-semibold transition-all disabled:opacity-50 sm:flex-none sm:min-w-[140px]"
              style={{
                background: active ? "var(--accent-soft)" : "var(--background-surface)",
                color: active ? "var(--accent)" : "var(--foreground-70)",
                borderColor: active
                  ? "color-mix(in oklab, var(--accent) 40%, var(--border))"
                  : "var(--border)",
              }}
            >
              {id === "now"
                ? t("components.postSchedule.publishNow")
                : t("components.postSchedule.schedule")}
            </button>
          );
        })}
      </div>

      {mode === "schedule" && (
        <div
          className="grid gap-[10px] rounded-[var(--r-card-sm)] border p-[12px] sm:grid-cols-2"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
        >
          <label className="block sm:col-span-1">
            <span
              className="mb-[6px] block text-[12px] font-medium"
              style={{ color: "var(--foreground-70)" }}
            >
              {t("components.postSchedule.date")}
            </span>
            <input
              type="date"
              value={date}
              min={minScheduleDateInput()}
              disabled={disabled}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-[44px] w-full rounded-[var(--r-input)] border px-[12px] text-[14px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </label>
          <label className="block sm:col-span-1">
            <span
              className="mb-[6px] block text-[12px] font-medium"
              style={{ color: "var(--foreground-70)" }}
            >
              {t("components.postSchedule.time")}
            </span>
            <input
              type="time"
              value={time}
              disabled={disabled}
              onChange={(e) => onTimeChange(e.target.value)}
              className="h-[44px] w-full rounded-[var(--r-input)] border px-[12px] text-[14px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </label>
          <label className="block sm:col-span-2">
            <span
              className="mb-[6px] block text-[12px] font-medium"
              style={{ color: "var(--foreground-70)" }}
            >
              {t("components.postSchedule.timezone")}
            </span>
            <select
              value={timezone}
              disabled={disabled}
              onChange={(e) => onTimezoneChange(e.target.value)}
              className="h-[44px] w-full cursor-pointer appearance-none rounded-[var(--r-input)] border px-[12px] text-[14px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            >
              {SCHEDULE_TIMEZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export function useInitialScheduleState() {
  const defaults = defaultScheduleDateTime();
  return {
    mode: "now" as PublishMode,
    date: defaults.date,
    time: defaults.time,
    timezone: defaultScheduleTimezone(),
  };
}
