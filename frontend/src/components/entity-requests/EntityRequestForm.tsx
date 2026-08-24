import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  applyChannel, applyCommunity, fetchCommunityCategories,
  type EntityKind, type CommunityCategoryOption,
} from "@/lib/api/entity-requests";
import { uploadMedia } from "@/lib/api/media";
import { prepareProfileImageFile, PROFILE_COVER_MAX_BYTES, PROFILE_IMAGE_ACCEPT } from "@/lib/profile-image";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { COMMUNITY_DESCRIPTION_MAX, COMMUNITY_NAME_MAX } from "@/lib/community-limits";
import { CHANNEL_NAME_MAX, CHANNEL_SLUG_MAX, kindLabel, type ChannelKind } from "@/lib/channels";
import { usePostCategories } from "@/lib/hooks/useCategories";
const OTHER_DIRECTION = "Другое";
const CHANNEL_KINDS: ChannelKind[] = ["brand", "shop", "author", "expert"];

function suggestSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CHANNEL_SLUG_MAX);
}

interface Props {
  kind: EntityKind;
  onClose: () => void;
  onSubmitted: () => void;
}

const TITLE: Record<EntityKind, string> = {
  channel: "Заявка на создание канала",
  community: "Заявка на создание сообщества",
};

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

export function EntityRequestForm({ kind, onClose, onSubmitted }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [channelKind, setChannelKind] = useState<ChannelKind>("author");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");            // channel: direction name
  const [customCategory, setCustomCategory] = useState(""); // channel: when «Другое»
  const [categoryId, setCategoryId] = useState<number | "">(""); // community
  const [cats, setCats] = useState<CommunityCategoryOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const directions = usePostCategories();
  useEffect(() => {
    if (kind !== "community") return;
    fetchCommunityCategories().then((list) => {
      setCats(list);
      if (list.length > 0) setCategoryId(list[0].id);
    }).catch(() => {});
  }, [kind]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const submit = async () => {
    if (name.trim().length < 3) { toast.error("Название — минимум 3 символа"); return; }
    setSubmitting(true);
    try {
      if (kind === "community") {
        if (!categoryId) { toast.error("Выберите категорию"); setSubmitting(false); return; }
        await applyCommunity({ proposedName: name.trim(), description: description.trim() || undefined, categoryId: Number(categoryId) });
      } else {
        if (!category) { toast.error("Выберите направление"); setSubmitting(false); return; }
        const resolvedCategory = category === OTHER_DIRECTION ? customCategory.trim() : category;
        if (!resolvedCategory) { toast.error("Укажите тематику"); setSubmitting(false); return; }

        let avatarUuid: string | null = null;
        let bannerUuid: string | null = null;
        if (pendingAvatar) {
          const media = await uploadMedia(pendingAvatar, "avatar");
          avatarUuid = media.uuid;
        }
        if (pendingBanner) {
          const media = await uploadMedia(pendingBanner, "banner");
          bannerUuid = media.uuid;
        }

        await applyChannel({
          name: name.trim(),
          description: description.trim() || undefined,
          category: resolvedCategory,
          slug: slug.trim() || undefined,
          kind: channelKind,
          comments_enabled: commentsEnabled,
          avatar_media_uuid: avatarUuid,
          banner_media_uuid: bannerUuid,
        });
      }
      toast.success("Заявка отправлена на рассмотрение");
      onSubmitted();
    } catch (e) {
      const already = e instanceof Error && /рассмотрении|pending|application/i.test(e.message);
      toast.error(already ? "У вас уже есть заявка на рассмотрении" : "Не удалось отправить заявку");
      setSubmitting(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col overflow-hidden rounded-t-[20px] sm:max-w-[520px] sm:rounded-[16px]"
        style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", maxHeight: "90dvh" }}
      >
        <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="flex-1 text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
            {TITLE[kind]}
          </h2>
          <button
            type="button" aria-label="Закрыть" onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              <span>Название</span>
              <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground-30)" }}>
                {name.length}/{kind === "community" ? COMMUNITY_NAME_MAX : CHANNEL_NAME_MAX}
              </span>
            </span>
            <input
              value={name}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (kind === "channel" && !slugTouched) setSlug(suggestSlug(next));
              }}
              maxLength={kind === "community" ? COMMUNITY_NAME_MAX : CHANNEL_NAME_MAX}
              placeholder={kind === "channel" ? "Название канала" : "Название сообщества"}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              <span>Описание <span style={{ color: "var(--foreground-50)" }}>(необязательно)</span></span>
              {kind === "community" && (
                <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground-30)" }}>{description.length}/{COMMUNITY_DESCRIPTION_MAX}</span>
              )}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={kind === "community" ? COMMUNITY_DESCRIPTION_MAX : 5000}
              rows={3}
              placeholder="Коротко о теме"
              className="resize-none rounded-[10px] border px-3 py-2 text-[14px] outline-none break-words" style={inputStyle}
            />
          </label>

          {kind === "community" ? (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Категория</span>
              <select
                value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
              >
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Направление</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                  style={inputStyle}
                >
                  <option value="">Выберите направление</option>
                  {directions.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  <option value={OTHER_DIRECTION}>{OTHER_DIRECTION}</option>
                </select>
              </label>
              {category === OTHER_DIRECTION && (
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Уточните тематику</span>
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    maxLength={120}
                    placeholder="Например: Стендовые модели"
                    className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
              )}
            </>
          )}

          {kind === "channel" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Адрес канала</span>
                <div className="flex items-center gap-1 rounded-[10px] border px-3" style={inputStyle}>
                  <span className="shrink-0 text-[13px]" style={{ color: "var(--foreground-50)" }}>modelizmclub.ru/channel/</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, CHANNEL_SLUG_MAX));
                    }}
                    maxLength={CHANNEL_SLUG_MAX}
                    placeholder="my-channel"
                    className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                    style={{ color: "var(--foreground)" }}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Тип канала</span>
                <select
                  value={channelKind}
                  onChange={(e) => setChannelKind(e.target.value as ChannelKind)}
                  className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                  style={inputStyle}
                >
                  {CHANNEL_KINDS.map((k) => (
                    <option key={k} value={k}>{kindLabel(k)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-3" style={{ borderColor: "var(--border)" }}>
                <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Разрешить комментарии</span>
                <input
                  type="checkbox"
                  checked={commentsEnabled}
                  onChange={(e) => setCommentsEnabled(e.target.checked)}
                />
              </label>
            </>
          )}

          {kind === "channel" && (
            <div className="rounded-[12px] border p-3" style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}>
              <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                Оформление <span style={{ color: "var(--foreground-50)" }}>(необязательно)</span>
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
                Аватар 480×480 · обложка 1400×400 · JPG, PNG, WEBP
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="rounded-[8px] border px-3 py-2 text-[12px] font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
                >
                  {avatarPreview ? "Изменить аватар" : "Загрузить аватар"}
                </button>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="rounded-[8px] border px-3 py-2 text-[12px] font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
                >
                  {bannerPreview ? "Изменить обложку" : "Загрузить обложку"}
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setPendingAvatar(await prepareProfileImageFile(file));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Не удалось обработать файл");
                }
              }} />
              <input ref={bannerInputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setPendingBanner(await prepareProfileImageFile(file, PROFILE_COVER_MAX_BYTES));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Не удалось обработать файл");
                }
              }} />
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            type="button" onClick={submit} disabled={submitting}
            className="h-12 w-full rounded-[12px] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {submitting ? "Отправляем…" : "Отправить заявку"}
          </button>
        </div>
      </div>

      <PhotoEditorDialog
        file={pendingAvatar}
        aspect={1}
        lockAspect
        shape="circle"
        lockShape
        outputWidth={480}
        outputHeight={480}
        title="Аватар канала"
        onCancel={() => setPendingAvatar(null)}
        onCropped={(blob) => {
          const file = new File([blob], "channel-avatar.jpg", { type: "image/jpeg" });
          setPendingAvatar(file);
          setAvatarPreview(URL.createObjectURL(file));
        }}
      />
      <PhotoEditorDialog
        file={pendingBanner}
        aspect={3.5}
        lockAspect
        shape="rect"
        lockShape
        outputWidth={1400}
        outputHeight={400}
        title="Обложка канала"
        safeZonePreset="cover-wide"
        onCancel={() => setPendingBanner(null)}
        onCropped={(blob) => {
          const file = new File([blob], "channel-banner.jpg", { type: "image/jpeg" });
          setPendingBanner(file);
          setBannerPreview(URL.createObjectURL(file));
        }}
      />
    </div>
  );
}
