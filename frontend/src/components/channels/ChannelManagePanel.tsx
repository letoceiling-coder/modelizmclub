import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DangerZone,
  ManageSection,
  SaveButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/entity/ManageFields";
import { inputStyle } from "@/components/entity/manageStyles";
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
    channel.category && !directionNames.includes(channel.category)
      ? otherDirection
      : channel.category,
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
    name.trim() !== channel.name ||
    description.trim() !== channel.description ||
    resolvedCategory !== (channel.category ?? "") ||
    (channel.kind !== "official" && kind !== channel.kind) ||
    commentsEnabled !== (channel.commentsEnabled !== false) ||
    rules.trim() !== (channel.rules ?? "") ||
    contacts.trim() !== (channel.contacts ?? "");

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
      <ManageSection title={t("components.channelManage.sectionBranding")} divided={false}>
        <ChannelBrandingForm channel={channel} onUpdated={onUpdated} />
      </ManageSection>

      <ManageSection title={t("components.channelManage.sectionMain")}>
        <TextField
          label={t("components.channelManage.nameLabel")}
          value={name}
          onChange={setName}
          max={CHANNEL_NAME_MAX}
        />

        <TextAreaField
          label={t("components.channelManage.descriptionLabel")}
          value={description}
          onChange={setDescription}
          max={5000}
          rows={5}
          minHeight={120}
        />

        <SelectField
          label={t("components.channelManage.themeLabel")}
          value={category}
          onChange={setCategory}
        >
          <option value="">{t("components.channelManage.selectDirection")}</option>
          {directions.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
          <option value={otherDirection}>{otherDirection}</option>
        </SelectField>

        {category === otherDirection && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              {t("components.channelManage.customThemeLabel")}
            </span>
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
          <SelectField
            label={t("components.channelManage.channelTypeLabel")}
            value={kind}
            onChange={(value) => setKind(value as ChannelKind)}
          >
            {EDITABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {t("components.channelManage.officialTypeLocked", { type: kindLabel(channel.kind) })}
          </p>
        )}

        <label
          className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            {t("components.channelManage.commentsLabel")}
          </span>
          <input
            type="checkbox"
            checked={commentsEnabled}
            onChange={(e) => setCommentsEnabled(e.target.checked)}
          />
        </label>

        <TextAreaField
          label={t("components.channelManage.contactsLabel")}
          value={contacts}
          onChange={setContacts}
          max={2000}
          rows={3}
          minHeight={80}
        />

        <TextAreaField
          label={t("components.channelManage.rulesLabel")}
          value={rules}
          onChange={setRules}
          max={5000}
          rows={4}
          minHeight={100}
        />

        <div
          className="rounded-[10px] border p-3 text-[13px]"
          style={{
            borderColor: "var(--border)",
            background: "var(--background-surface)",
            color: "var(--foreground-70)",
          }}
        >
          {t("components.channelManage.publicNotice")}
        </div>

        <SaveButton
          disabled={!dirty || saving}
          busy={saving}
          label={t("components.channelManage.saveChanges")}
          busyLabel={t("components.channelManage.saving")}
          onClick={() => void save()}
        />
      </ManageSection>

      <DangerZone
        title={t("components.channelManage.sectionDanger")}
        warning={t("components.channelManage.deleteWarning")}
      >
        <DeleteChannelDialog slug={channel.slug} name={channel.name} onDeleted={onDeleted} />
      </DangerZone>
    </div>
  );
}
