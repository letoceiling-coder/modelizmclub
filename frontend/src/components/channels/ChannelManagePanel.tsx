import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DeleteChannelDialog } from "@/components/channels/DeleteChannelDialog";
import { ChannelBrandingForm } from "@/components/channels/ChannelBrandingForm";
import {
  updateChannel,
  kindLabel,
  CHANNEL_NAME_MAX,
  type Channel,
  type ChannelKind,
} from "@/lib/channels";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";

const EDITABLE_KINDS: ChannelKind[] = ["author", "expert", "brand", "shop"];

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

interface Props {
  channel: Channel;
  onUpdated: (channel: Channel) => void;
  onDeleted: () => void;
}

export function ChannelManagePanel({ channel, onUpdated, onDeleted }: Props) {
  const { t } = useTranslation();
  const otherDirection = t("components.channelManage.otherDirection");
  const directions = usePostCategories();
  const directionNames = useMemo(() => directions.map((d) => d.name), [directions]);

  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [kind, setKind] = useState<ChannelKind>(channel.kind);
  const [commentsEnabled, setCommentsEnabled] = useState(channel.commentsEnabled !== false);
  const [rules, setRules] = useState(channel.rules ?? "");
  const [contacts, setContacts] = useState(channel.contacts ?? "");
  const [category, setCategory] = useState(
    channel.category && !directionNames.includes(channel.category) ? otherDirection : channel.category,
  );
  const [customCategory, setCustomCategory] = useState(
    channel.category && !directionNames.includes(channel.category) ? channel.category : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description);
    setKind(channel.kind);
    setCommentsEnabled(channel.commentsEnabled !== false);
    setRules(channel.rules ?? "");
    setContacts(channel.contacts ?? "");
    const inList = directionNames.includes(channel.category);
    setCategory(inList ? channel.category : channel.category ? otherDirection : "");
    setCustomCategory(inList ? "" : channel.category);
  }, [channel, directionNames, otherDirection]);

  const resolvedCategory = category === otherDirection ? customCategory.trim() : category.trim();

  const dirty =
    name.trim() !== channel.name
    || description.trim() !== channel.description
    || resolvedCategory !== (channel.category ?? "")
    || (channel.kind !== "official" && kind !== channel.kind)
    || commentsEnabled !== (channel.commentsEnabled !== false)
    || rules.trim() !== (channel.rules ?? "")
    || contacts.trim() !== (channel.contacts ?? "");

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("components.channelManage.nameRequired"));
      return;
    }
    if (category === otherDirection && !customCategory.trim()) {
      toast.error(t("components.channelManage.themeRequired"));
      return;
    }

    setSaving(true);
    try {
      if (isDemoMode()) {
        toast.success(t("components.channelManage.savedDemo"));
        onUpdated({
          ...channel,
          name: name.trim(),
          description: description.trim(),
          category: resolvedCategory,
          kind: channel.kind === "official" ? channel.kind : kind,
        });
        return;
      }

      const updated = await updateChannel(channel.slug, {
        name: name.trim(),
        description: description.trim(),
        category: resolvedCategory || undefined,
        comments_enabled: commentsEnabled,
        rules: rules.trim(),
        contacts: contacts.trim(),
        ...(channel.kind !== "official" ? { kind } : {}),
      });
      onUpdated(updated);
      toast.success(t("components.channelManage.saved"));
    } catch {
      toast.error(t("components.channelManage.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
          {t("components.channelManage.sectionBranding")}
        </h3>
        <ChannelBrandingForm channel={channel} onUpdated={onUpdated} />
      </section>

      <section className="space-y-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
          {t("components.channelManage.sectionMain")}
        </h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.nameLabel")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={CHANNEL_NAME_MAX}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
              style={inputStyle}
            />
            <span className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {name.length}/{CHANNEL_NAME_MAX}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.descriptionLabel")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y min-h-[120px]"
              style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.themeLabel")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
              style={inputStyle}
            >
              <option value="">{t("components.channelManage.selectDirection")}</option>
              {directions.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
              <option value={otherDirection}>{otherDirection}</option>
            </select>
          </label>

          {category === otherDirection && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.customThemeLabel")}</span>
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                maxLength={120}
                placeholder={t("components.channelManage.customThemePlaceholder")}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                style={inputStyle}
              />
            </label>
          )}

          {channel.kind !== "official" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.channelTypeLabel")}</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ChannelKind)}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                style={inputStyle}
              >
                {EDITABLE_KINDS.map((k) => (
                  <option key={k} value={k}>{kindLabel(k)}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("components.channelManage.officialTypeLocked", { type: kindLabel(channel.kind) })}
            </p>
          )}

          <label className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              {t("components.channelManage.commentsLabel")}
            </span>
            <input
              type="checkbox"
              checked={commentsEnabled}
              onChange={(e) => setCommentsEnabled(e.target.checked)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.contactsLabel")}</span>
            <textarea
              value={contacts}
              onChange={(e) => setContacts(e.target.value)}
              maxLength={2000}
              rows={3}
              className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y min-h-[80px]"
              style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelManage.rulesLabel")}</span>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              maxLength={5000}
              rows={4}
              className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y min-h-[100px]"
              style={inputStyle}
            />
          </label>

          <div
            className="rounded-[10px] border p-3 text-[13px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)", color: "var(--foreground-70)" }}
          >
            {t("components.channelManage.publicNotice")}
          </div>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="w-full rounded-[12px] gap-2 sm:w-auto"
          >
            <Save size={16} />
            {saving ? t("components.channelManage.saving") : t("components.channelManage.saveChanges")}
          </Button>
      </section>

      <section className="space-y-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
          {t("components.channelManage.sectionDanger")}
        </h3>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
          {t("components.channelManage.deleteWarning")}
        </p>
        <DeleteChannelDialog slug={channel.slug} name={channel.name} onDeleted={onDeleted} />
      </section>
    </div>
  );
}
