import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildSchedulePayload,
  defaultScheduleDateTime,
  defaultScheduleTimezone,
  isScheduleDateTimeValid,
} from "@/lib/post-schedule";
import { schedulePost } from "@/lib/api/feed";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import type { Post } from "@/lib/mock";

interface Props {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (post: Post) => void;
}

export function SchedulePostDialog({ post, open, onOpenChange, onUpdated }: Props) {
  const { t } = useTranslation();
  const defaults = defaultScheduleDateTime();
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [timezone, setTimezone] = useState(defaultScheduleTimezone());
  const [saving, setSaving] = useState(false);

  const handleOpen = (next: boolean) => {
    if (next && post?.scheduledAt) {
      const d = new Date(post.scheduledAt);
      setDate(d.toISOString().slice(0, 10));
      setTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }
    onOpenChange(next);
  };

  const save = async () => {
    if (!post) return;
    if (!isScheduleDateTimeValid(date, time)) {
      toast.error(t("components.postSchedule.invalidDateTime"));
      return;
    }
    setSaving(true);
    try {
      const updated = await schedulePost(post.id, buildSchedulePayload(date, time, timezone));
      toast.success(t("components.postSchedule.rescheduled"));
      onUpdated?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("components.postSchedule.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("components.postSchedule.changeDate")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-[10px]">
          <label className="block">
            <span
              className="mb-[6px] block text-[12px] font-medium"
              style={{ color: "var(--foreground-70)" }}
            >
              {t("components.postSchedule.date")}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-[44px] w-full rounded-[var(--r-input)] border px-[12px] text-[14px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </label>
          <label className="block">
            <span
              className="mb-[6px] block text-[12px] font-medium"
              style={{ color: "var(--foreground-70)" }}
            >
              {t("components.postSchedule.time")}
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-[44px] w-full rounded-[var(--r-input)] border px-[12px] text-[14px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </label>
          <label className="block">
            <span
              className="mb-[6px] block text-[12px] font-medium"
              style={{ color: "var(--foreground-70)" }}
            >
              {t("components.postSchedule.timezone")}
            </span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-[44px] w-full rounded-[var(--r-input)] border px-[12px] text-[14px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            >
              <option value="Europe/Moscow">Москва (UTC+3)</option>
              <option value="Europe/Kaliningrad">Калининград (UTC+2)</option>
              <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
              <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="mt-[4px] h-[44px] rounded-[var(--r-button)] text-[14px] font-semibold disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {saving ? t("components.postSchedule.saving") : t("components.postSchedule.save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
