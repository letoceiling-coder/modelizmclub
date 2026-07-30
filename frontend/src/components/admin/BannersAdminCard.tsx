import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, MousePointerClick, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { StatusBadge } from "@/components/StatusBadge";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { BannerHeroSlide } from "@/components/feed/BannerHeroSlide";
import { SponsoredPostCard } from "@/components/feed/SponsoredPostCard";
import {
  createAdminBanner,
  deleteAdminBanner,
  fetchAdminBanners,
  updateAdminBanner,
  updateBannerCarouselSettings,
  type AdminBannerRow,
  type BannerCarouselSettings,
} from "@/lib/api/admin";
import { uploadMedia } from "@/lib/api/media";

const PLACEMENTS = [
  { value: "events", label: "Лента — верхний слайдер" },
  { value: "feed", label: "Лента — встроенные объявления" },
] as const;

const KINDS = [
  { value: "event", label: "Событие" },
  { value: "news", label: "Новость" },
  { value: "promo", label: "Акция" },
] as const;

const inputStyle: CSSProperties = {
  height: "40px",
  background: "var(--background)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
  width: "100%",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: "72px",
  padding: "10px 14px",
  resize: "vertical" as const,
};

const primaryBtn: CSSProperties = {
  height: "40px",
  padding: "0 18px",
  borderRadius: "var(--r-button)",
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  height: "36px",
  padding: "0 12px",
  borderRadius: "var(--r-button)",
  background: "transparent",
  color: "var(--foreground-70)",
  fontSize: "13px",
  border: "1px solid var(--border)",
  cursor: "pointer",
};

const BANNER_IMAGE_HINT = "Рекомендуемый размер: 1920×500 px (JPG, PNG или WebP).";

type PreviewableBanner = Pick<
  AdminBannerRow,
  "id" | "imageUrl" | "title" | "text" | "ctaText" | "kind" | "untilLabel"
>;

/**
 * WYSIWYG preview — renders the exact same `BannerHeroSlide`/`SponsoredPostCard`
 * components the real feed uses, so title placement, dimming, text wrapping and
 * the CTA button always match production pixel-for-pixel instead of drifting
 * out of sync with a hand-rolled approximation.
 */
function BannerImagePreview({ banner, placement }: { banner: PreviewableBanner; placement: string }) {
  const isHero = placement === "events";

  return (
    <div className="mt-[12px] space-y-[10px]">
      {isHero ? (
        <>
          <div>
            <div
              className="mb-[6px] text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--foreground-50)" }}
            >
              Как на ленте
            </div>
            <div
              className="relative overflow-hidden rounded-[16px] border"
              style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
            >
              <div className="relative h-[200px] sm:h-[220px] md:h-[240px]">
                <BannerHeroSlide
                  banner={{
                    image: banner.imageUrl,
                    title: banner.title,
                    text: banner.text,
                    cta: banner.ctaText || "Подробнее",
                    kind: banner.kind || "news",
                    until: banner.untilLabel,
                  }}
                  ctaDisabled
                />
              </div>
            </div>
          </div>
          {banner.imageUrl && (
            <div>
              <div
                className="mb-[6px] text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--foreground-50)" }}
              >
                Загруженное изображение целиком
              </div>
              <div
                className="flex min-h-[100px] items-center justify-center rounded-[12px] border p-[10px]"
                style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
              >
                <img src={banner.imageUrl} alt="" className="max-h-[220px] max-w-full object-contain" />
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <div
            className="mb-[6px] text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--foreground-50)" }}
          >
            Как на ленте (нативный пост)
          </div>
          <SponsoredPostCard
            banner={{
              id: banner.id,
              title: banner.title || "Заголовок баннера",
              text: banner.text,
              cta: banner.ctaText || "Подробнее",
              until: banner.untilLabel,
              color: "from-rose-500 to-orange-600",
            }}
          />
        </div>
      )}
    </div>
  );
}

type ScheduleStatus = { label: string; variant: "default" | "success" | "warning" | "info" | "published" };

function bannerScheduleStatus(b: Pick<AdminBannerRow, "isActive" | "forceVisible" | "startsAt" | "endsAt">): ScheduleStatus {
  if (!b.isActive) return { label: "Скрыт", variant: "default" };
  if (b.forceVisible) return { label: "Тестовый показ", variant: "warning" };
  const now = Date.now();
  const start = b.startsAt ? Date.parse(`${b.startsAt}T00:00:00`) : NaN;
  const end = b.endsAt ? Date.parse(`${b.endsAt}T23:59:59`) : NaN;
  if (!Number.isNaN(start) && start > now) return { label: "Запланирован", variant: "info" };
  if (!Number.isNaN(end) && end < now) return { label: "Завершён", variant: "default" };
  return { label: "Активен", variant: "success" };
}

function emptyBanner(): Omit<AdminBannerRow, "id" | "impressionsCount" | "clicksCount"> {
  return {
    placement: "events",
    title: "",
    text: "",
    ctaText: "Подробнее",
    kind: "event",
    untilLabel: "",
    linkUrl: "",
    imageUrl: null,
    imageMediaUuid: null,
    startsAt: "",
    endsAt: "",
    isActive: true,
    forceVisible: false,
    isPinned: false,
    priority: 0,
    sortOrder: 0,
  };
}

export function BannersAdminCard({ cardStyle }: { cardStyle: CSSProperties }) {
  const [carousel, setCarousel] = useState<BannerCarouselSettings>({
    enabled: true,
    placement: "events",
    autoplay_seconds: 10,
    max_slides: 5,
  });
  const [banners, setBanners] = useState<AdminBannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCarousel, setSavingCarousel] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyBanner());
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | "new" | null>(null);

  const reload = () =>
    fetchAdminBanners()
      .then(({ banners: list, carousel: c }) => {
        setBanners(list);
        setCarousel(c);
      })
      .catch(() => toast.error("Не удалось загрузить баннеры"));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const saveCarousel = async () => {
    setSavingCarousel(true);
    try {
      const next = await updateBannerCarouselSettings(carousel);
      setCarousel(next);
      toast.success("Настройки слайдера сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки слайдера");
    } finally {
      setSavingCarousel(false);
    }
  };

  const patchBanner = (id: string, patch: Partial<AdminBannerRow>) =>
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const saveBanner = async (row: AdminBannerRow) => {
    setSavingId(row.id);
    try {
      const saved = await updateAdminBanner(row.id, {
        placement: row.placement,
        title: row.title,
        text: row.text,
        cta_text: row.ctaText,
        kind: row.kind || null,
        until_label: row.untilLabel || null,
        link_url: row.linkUrl || null,
        image_media_uuid: row.imageMediaUuid,
        starts_at: row.startsAt || null,
        ends_at: row.endsAt || null,
        is_active: row.isActive,
        force_visible: row.forceVisible,
        is_pinned: row.isPinned,
        priority: row.priority,
        sort_order: row.sortOrder,
      });
      patchBanner(row.id, { ...saved, imageMediaUuid: null });
      toast.success("Баннер сохранён");
    } catch {
      toast.error("Не удалось сохранить баннер");
    } finally {
      setSavingId(null);
    }
  };

  const removeBanner = async (id: string) => {
    if (!window.confirm("Удалить баннер?")) return;
    try {
      await deleteAdminBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      toast.success("Баннер удалён");
    } catch {
      toast.error("Не удалось удалить баннер");
    }
  };

  const createBanner = async () => {
    if (!draft.title.trim()) {
      toast.error("Укажите заголовок баннера");
      return;
    }
    setCreating(true);
    try {
      const created = await createAdminBanner({
        placement: draft.placement,
        title: draft.title.trim(),
        text: draft.text,
        cta_text: draft.ctaText,
        kind: draft.kind || undefined,
        until_label: draft.untilLabel || undefined,
        link_url: draft.linkUrl || undefined,
        image_media_uuid: draft.imageMediaUuid ?? undefined,
        starts_at: draft.startsAt || null,
        ends_at: draft.endsAt || null,
        is_active: draft.isActive,
        force_visible: draft.forceVisible,
        is_pinned: draft.isPinned,
        priority: draft.priority,
        sort_order: draft.sortOrder,
      });
      setBanners((prev) => [created, ...prev]);
      setDraft(emptyBanner());
      toast.success("Баннер создан");
    } catch {
      toast.error("Не удалось создать баннер");
    } finally {
      setCreating(false);
    }
  };

  const [editorSrc, setEditorSrc] = useState<File | string | null>(null);

  const onPickImage = (target: string | "new") => {
    setUploadTarget(target);
    fileRef.current?.click();
  };

  const onEditImage = (target: string | "new", src: string) => {
    setUploadTarget(target);
    setEditorSrc(src);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadTarget) return;
    // Route every picked banner photo through the editor before upload —
    // banners get cropped/resized freely, so there's no fixed aspect to lock.
    setEditorSrc(file);
  };

  const applyEditedBanner = async (blob: Blob) => {
    const target = uploadTarget;
    setEditorSrc(null);
    if (!target) return;
    try {
      const file = new File([blob], "banner.jpg", { type: blob.type || "image/jpeg" });
      const media = await uploadMedia(file, "banner");
      if (target === "new") {
        setDraft((d) => ({ ...d, imageMediaUuid: media.uuid, imageUrl: media.url }));
      } else {
        patchBanner(target, { imageMediaUuid: media.uuid, imageUrl: media.url });
      }
      toast.success("Изображение загружено — сохраните баннер");
    } catch {
      toast.error("Не загрузить изображение");
    } finally {
      setUploadTarget(null);
    }
  };

  const heroBanners = banners.filter((b) => b.placement === carousel.placement);

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
      <PhotoEditorDialog
        open={editorSrc != null}
        src={editorSrc}
        title="Редактирование фото баннера"
        onCancel={() => {
          setEditorSrc(null);
          setUploadTarget(null);
        }}
        onSave={applyEditedBanner}
      />

      <div style={{ ...cardStyle, padding: "24px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "8px" }}>
          Слайдер на ленте
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          Блок над лентой постов. Переключение слайдов, лимит показа и статистика просмотров настраиваются здесь.
        </p>

        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Размещение слайдера</span>
              <select
                value={carousel.placement}
                onChange={(e) => setCarousel((c) => ({ ...c, placement: e.target.value }))}
                style={inputStyle}
              >
                {PLACEMENTS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Интервал, сек</span>
              <input
                type="number"
                min={3}
                max={120}
                value={carousel.autoplay_seconds}
                onChange={(e) => setCarousel((c) => ({ ...c, autoplay_seconds: +e.target.value || 10 }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Макс. слайдов</span>
              <input
                type="number"
                min={1}
                max={10}
                value={carousel.max_slides}
                onChange={(e) => setCarousel((c) => ({ ...c, max_slides: +e.target.value || 5 }))}
                style={inputStyle}
              />
            </label>
            <label className="flex items-center gap-[8px]" style={{ alignSelf: "end", height: 40 }}>
              <input
                type="checkbox"
                checked={carousel.enabled}
                onChange={(e) => setCarousel((c) => ({ ...c, enabled: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <span style={{ fontSize: "13px", color: "var(--foreground-70)" }}>Показывать слайдер</span>
            </label>
          </div>
        )}

        <button type="button" onClick={saveCarousel} disabled={savingCarousel} style={{ ...primaryBtn, marginTop: "14px" }}>
          {savingCarousel ? "Сохранение…" : "Сохранить настройки слайдера"}
        </button>
      </div>

      <div style={{ ...cardStyle, padding: "24px" }}>
        <div className="flex items-center justify-between gap-[8px] flex-wrap">
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>
            Новый баннер
          </h4>
          <div className="flex items-center gap-[8px]">
            {draft.imageUrl && (
              <button type="button" onClick={() => onEditImage("new", draft.imageUrl!)} style={ghostBtn}>
                <Pencil size={14} className="inline mr-1" /> Редактировать
              </button>
            )}
            <button type="button" onClick={() => onPickImage("new")} style={ghostBtn}>
              <Upload size={14} className="inline mr-1" /> Загрузить фото
            </button>
          </div>
        </div>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "8px" }}>{BANNER_IMAGE_HINT}</p>

        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "12px", marginTop: "12px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Размещение</span>
            <select value={draft.placement} onChange={(e) => setDraft((d) => ({ ...d, placement: e.target.value }))} style={inputStyle}>
              {PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Тип</span>
            <select
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as AdminBannerRow["kind"] }))}
              style={inputStyle}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "6px", gridColumn: "1 / -1" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Заголовок</span>
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px", gridColumn: "1 / -1" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Текст</span>
            <textarea value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} style={textareaStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Кнопка (CTA)</span>
            <input value={draft.ctaText} onChange={(e) => setDraft((d) => ({ ...d, ctaText: e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Подпись срока</span>
            <input value={draft.untilLabel} onChange={(e) => setDraft((d) => ({ ...d, untilLabel: e.target.value }))} placeholder="до 15 авг" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px", gridColumn: "1 / -1" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>Ссылка</span>
            <input value={draft.linkUrl} onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))} placeholder="/communities или https://…" style={inputStyle} />
          </label>
        </div>

        <BannerImagePreview
          banner={{
            id: "new",
            imageUrl: draft.imageUrl,
            title: draft.title,
            text: draft.text,
            ctaText: draft.ctaText,
            kind: draft.kind,
            untilLabel: draft.untilLabel,
          }}
          placement={draft.placement}
        />

        <button type="button" onClick={createBanner} disabled={creating} style={{ ...primaryBtn, marginTop: "14px" }}>
          <Plus size={14} className="inline mr-1" />
          {creating ? "Создание…" : "Добавить баннер"}
        </button>
      </div>

      <div style={{ ...cardStyle, padding: "24px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          Баннеры ({banners.length})
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          В слайдере сейчас: {heroBanners.filter((b) => b.isActive).length} активных из placement «{carousel.placement}»
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {banners.map((b) => (
            <div
              key={b.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card-sm)",
                padding: "16px",
                background: b.isPinned ? "var(--accent-soft)" : "transparent",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-[12px]">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>{b.title || "Без названия"}</div>
                    {(() => {
                      const st = bannerScheduleStatus(b);
                      return <StatusBadge variant={st.variant}>{st.label}</StatusBadge>;
                    })()}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: 2 }}>
                    {PLACEMENTS.find((p) => p.value === b.placement)?.label ?? b.placement}
                    {b.startsAt || b.endsAt ? (
                      <span>
                        {" · "}
                        {b.startsAt ? `с ${new Date(`${b.startsAt}T00:00:00`).toLocaleDateString("ru-RU")}` : "без начала"}
                        {b.endsAt ? ` по ${new Date(`${b.endsAt}T00:00:00`).toLocaleDateString("ru-RU")}` : ""}
                      </span>
                    ) : null}
                  </div>
                  {bannerScheduleStatus(b).label === "Запланирован" && (
                    <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: 6 }}>
                      Баннер появится в ленте после наступления даты «С». Для теста включите «Тестовый показ».
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-[12px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
                  <span className="inline-flex items-center gap-[4px]"><Eye size={14} /> {b.impressionsCount.toLocaleString("ru")}</span>
                  <span className="inline-flex items-center gap-[4px]"><MousePointerClick size={14} /> {b.clicksCount.toLocaleString("ru")}</span>
                  <button type="button" onClick={() => removeBanner(b.id)} style={{ ...ghostBtn, color: "var(--destructive, #c0392b)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <BannerImagePreview
                banner={{
                  id: b.id,
                  imageUrl: b.imageUrl,
                  title: b.title,
                  text: b.text,
                  ctaText: b.ctaText,
                  kind: b.kind,
                  untilLabel: b.untilLabel,
                }}
                placement={b.placement}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: "10px", marginTop: "12px" }}>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Заголовок</span>
                  <input value={b.title} onChange={(e) => patchBanner(b.id, { title: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Размещение</span>
                  <select value={b.placement} onChange={(e) => patchBanner(b.id, { placement: e.target.value })} style={inputStyle}>
                    {PLACEMENTS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Тип</span>
                  <select
                    value={b.kind}
                    onChange={(e) => patchBanner(b.id, { kind: e.target.value as AdminBannerRow["kind"] })}
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "4px", gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Текст</span>
                  <textarea value={b.text} onChange={(e) => patchBanner(b.id, { text: e.target.value })} style={textareaStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>CTA</span>
                  <input value={b.ctaText} onChange={(e) => patchBanner(b.id, { ctaText: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Срок</span>
                  <input value={b.untilLabel} onChange={(e) => patchBanner(b.id, { untilLabel: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Ссылка</span>
                  <input value={b.linkUrl} onChange={(e) => patchBanner(b.id, { linkUrl: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Приоритет</span>
                  <input type="number" min={0} value={b.priority} onChange={(e) => patchBanner(b.id, { priority: +e.target.value || 0 })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>Порядок</span>
                  <input type="number" min={0} value={b.sortOrder} onChange={(e) => patchBanner(b.id, { sortOrder: +e.target.value || 0 })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>С</span>
                  <input type="date" value={b.startsAt} onChange={(e) => patchBanner(b.id, { startsAt: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>По</span>
                  <input type="date" value={b.endsAt} onChange={(e) => patchBanner(b.id, { endsAt: e.target.value })} style={inputStyle} />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-[12px] mt-[12px]">
                <label className="flex items-center gap-[6px] cursor-pointer">
                  <input type="checkbox" checked={b.isActive} onChange={(e) => patchBanner(b.id, { isActive: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: "13px" }}>Показывать</span>
                </label>
                <label className="flex items-center gap-[6px] cursor-pointer">
                  <input type="checkbox" checked={b.isPinned} onChange={(e) => patchBanner(b.id, { isPinned: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: "13px" }}>Закрепить</span>
                </label>
                <label className="flex items-center gap-[6px] cursor-pointer" title="Показывать в ленте до наступления даты «С»">
                  <input type="checkbox" checked={b.forceVisible} onChange={(e) => patchBanner(b.id, { forceVisible: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: "13px" }}>Тестовый показ</span>
                </label>
                <button type="button" onClick={() => onPickImage(b.id)} style={ghostBtn}>Фото</button>
                {b.imageUrl && (
                  <button type="button" onClick={() => onEditImage(b.id, b.imageUrl!)} style={ghostBtn}>
                    <Pencil size={14} className="inline mr-1" /> Редактировать
                  </button>
                )}
                {(b.forceVisible || bannerScheduleStatus(b).label === "Активен") && b.placement === "events" && (
                  <Link to="/feed" target="_blank" style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                    <Eye size={14} className="mr-1" /> Предпросмотр
                  </Link>
                )}
                <button type="button" onClick={() => saveBanner(b)} disabled={savingId === b.id} style={primaryBtn}>
                  {savingId === b.id ? "…" : "Сохранить"}
                </button>
              </div>
            </div>
          ))}

          {!loading && banners.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--foreground-50)", textAlign: "center", padding: "24px 0" }}>
              Баннеров пока нет — добавьте первый выше.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
