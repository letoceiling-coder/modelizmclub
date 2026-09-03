import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Eye, MousePointerClick, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { StatusBadge } from "@/components/StatusBadge";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { BANNER_ASPECT, BANNER_EXPORT_HEIGHT, BANNER_EXPORT_WIDTH } from "@/lib/photo-editor-safe-zones";
import { BannerHeroSlide, BANNER_HERO_HEIGHT } from "@/components/feed/BannerHeroSlide";
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
import { uploadAdminMedia } from "@/lib/api/admin-media";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";

const BANNER_LIMITS = {
  title: 200,
  text: 2000,
  cta: 100,
  untilLabel: 128,
  linkUrl: 500,
} as const;

function CharCounter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span
      className="text-[11px] tabular-nums"
      style={{ color: over ? "var(--destructive, #c0392b)" : "var(--foreground-40)" }}
    >
      {value.length}/{max}
    </span>
  );
}

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
function BannerImagePreview({
  banner,
  placement,
  defaultCta,
}: {
  banner: PreviewableBanner;
  placement: string;
  defaultCta: string;
}) {
  const { t } = useTranslation();
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
              {t("pages.adminBanners.preview.asOnFeed")}
            </div>
            <div
              className="relative overflow-hidden rounded-[16px] border"
              style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
            >
              <div className={`relative ${BANNER_HERO_HEIGHT}`}>
                <BannerHeroSlide
                  banner={{
                    image: banner.imageUrl,
                    title: banner.title,
                    text: banner.text,
                    cta: banner.ctaText || defaultCta,
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
                {t("pages.adminBanners.preview.fullImage")}
              </div>
              <div
                className="flex min-h-[100px] items-center justify-center rounded-[12px] border p-[10px]"
                style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
              >
                <img src={banner.imageUrl} width={1200} height={400} loading="lazy" decoding="async" alt="" className="max-h-[220px] max-w-full object-contain" />
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
            {t("pages.adminBanners.preview.asNativePost")}
          </div>
          <SponsoredPostCard
            banner={{
              id: banner.id,
              title: banner.title || t("pages.adminBanners.preview.bannerTitleFallback"),
              text: banner.text,
              cta: banner.ctaText || defaultCta,
              until: banner.untilLabel,
              color: "from-rose-500 to-orange-600",
            }}
          />
        </div>
      )}
    </div>
  );
}

type ScheduleStatusKey = "hidden" | "test" | "scheduled" | "ended" | "active";
type ScheduleStatus = { key: ScheduleStatusKey; variant: "default" | "success" | "warning" | "info" | "published" };

function bannerScheduleStatus(b: Pick<AdminBannerRow, "isActive" | "forceVisible" | "startsAt" | "endsAt">): ScheduleStatus {
  if (!b.isActive) return { key: "hidden", variant: "default" };
  if (b.forceVisible) return { key: "test", variant: "warning" };
  const now = Date.now();
  const start = b.startsAt ? Date.parse(`${b.startsAt}T00:00:00`) : NaN;
  const end = b.endsAt ? Date.parse(`${b.endsAt}T23:59:59`) : NaN;
  if (!Number.isNaN(start) && start > now) return { key: "scheduled", variant: "info" };
  if (!Number.isNaN(end) && end < now) return { key: "ended", variant: "default" };
  return { key: "active", variant: "success" };
}

function emptyBanner(defaultCta: string): Omit<AdminBannerRow, "id" | "impressionsCount" | "clicksCount"> {
  return {
    placement: "events",
    title: "",
    text: "",
    ctaText: defaultCta,
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
  const { t } = useTranslation();
  const defaultCta = t("pages.adminBanners.defaultCta");

  const placements = useMemo(
    () =>
      [
        { value: "events", label: t("pages.adminBanners.placements.events") },
        { value: "feed", label: t("pages.adminBanners.placements.feed") },
      ] as const,
    [t],
  );

  const kinds = useMemo(
    () =>
      [
        { value: "event", label: t("pages.adminBanners.kinds.event") },
        { value: "news", label: t("pages.adminBanners.kinds.news") },
        { value: "promo", label: t("pages.adminBanners.kinds.promo") },
      ] as const,
    [t],
  );

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
  const [draft, setDraft] = useState(() => emptyBanner(defaultCta));
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | "new" | null>(null);

  const reload = () =>
    fetchAdminBanners()
      .then(({ banners: list, carousel: c }) => {
        setBanners(list);
        setCarousel(c);
      })
      .catch(() => toast.error(t("pages.adminBanners.toast.loadFailed")));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [t]);

  const saveCarousel = async () => {
    setSavingCarousel(true);
    try {
      const next = await updateBannerCarouselSettings(carousel);
      setCarousel(next);
      toast.success(t("pages.adminBanners.carousel.saved"));
    } catch {
      toast.error(t("pages.adminBanners.carousel.saveFailed"));
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
      toast.success(t("pages.adminBanners.toast.bannerSaved"));
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.adminBanners.toast.bannerSaveFailed")));
    } finally {
      setSavingId(null);
    }
  };

  const removeBanner = async (id: string) => {
    if (!window.confirm(t("pages.adminBanners.toast.deleteConfirm"))) return;
    try {
      await deleteAdminBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      toast.success(t("pages.adminBanners.toast.bannerDeleted"));
    } catch {
      toast.error(t("pages.adminBanners.toast.bannerDeleteFailed"));
    }
  };

  const createBanner = async () => {
    if (!draft.title.trim()) {
      toast.error(t("pages.adminBanners.toast.titleRequired"));
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
      setDraft(emptyBanner(defaultCta));
      toast.success(t("pages.adminBanners.toast.bannerCreated"));
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.adminBanners.toast.bannerCreateFailed")));
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
      const media = await uploadAdminMedia(file, "banner");
      if (target === "new") {
        setDraft((d) => ({ ...d, imageMediaUuid: media.uuid, imageUrl: media.url }));
      } else {
        patchBanner(target, { imageMediaUuid: media.uuid, imageUrl: media.url });
      }
      toast.success(t("pages.adminBanners.toast.imageUploaded"));
    } catch {
      toast.error(t("pages.adminBanners.toast.imageUploadFailed"));
    } finally {
      setUploadTarget(null);
    }
  };

  const heroBanners = banners.filter((b) => b.placement === carousel.placement);
  const carouselPlacementLabel = placements.find((p) => p.value === carousel.placement)?.label ?? carousel.placement;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
      <PhotoEditorDialog
        open={editorSrc != null}
        src={editorSrc}
        title={t("pages.adminBanners.photoEditorTitle")}
        safeZonePreset="feed-banner"
        aspect={BANNER_ASPECT}
        lockAspect
        lockShape
        outputWidth={BANNER_EXPORT_WIDTH}
        outputHeight={BANNER_EXPORT_HEIGHT}
        onCancel={() => {
          setEditorSrc(null);
          setUploadTarget(null);
        }}
        onSave={applyEditedBanner}
      />

      <div style={{ ...cardStyle, padding: "24px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "8px" }}>
          {t("pages.adminBanners.carousel.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminBanners.carousel.hint")}
        </p>

        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminBanners.carousel.placementLabel")}</span>
              <select
                value={carousel.placement}
                onChange={(e) => setCarousel((c) => ({ ...c, placement: e.target.value }))}
                style={inputStyle}
              >
                {placements.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminBanners.carousel.intervalLabel")}</span>
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
              <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminBanners.carousel.maxSlidesLabel")}</span>
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
              <span style={{ fontSize: "13px", color: "var(--foreground-70)" }}>{t("pages.adminBanners.carousel.enabledLabel")}</span>
            </label>
          </div>
        )}

        <button type="button" onClick={saveCarousel} disabled={savingCarousel} style={{ ...primaryBtn, marginTop: "14px" }}>
          {savingCarousel ? t("pages.adminBanners.carousel.saving") : t("pages.adminBanners.carousel.save")}
        </button>
      </div>

      <div style={{ ...cardStyle, padding: "24px" }}>
        <div className="flex items-center justify-between gap-[8px] flex-wrap">
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>
            {t("pages.adminBanners.form.newTitle")}
          </h4>
          <div className="flex items-center gap-[8px]">
            {draft.imageUrl && (
              <button type="button" onClick={() => onEditImage("new", draft.imageUrl!)} style={ghostBtn}>
                <Pencil size={14} className="inline mr-1" /> {t("pages.adminBanners.form.edit")}
              </button>
            )}
            <button type="button" onClick={() => onPickImage("new")} style={ghostBtn}>
              <Upload size={14} className="inline mr-1" /> {t("pages.adminBanners.form.uploadPhoto")}
            </button>
          </div>
        </div>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "8px" }}>{t("pages.adminBanners.imageHint")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "12px", marginTop: "12px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminBanners.form.placement")}</span>
            <select value={draft.placement} onChange={(e) => setDraft((d) => ({ ...d, placement: e.target.value }))} style={inputStyle}>
              {placements.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-70)" }}>{t("pages.adminBanners.form.kind")}</span>
            <select
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as AdminBannerRow["kind"] }))}
              style={inputStyle}
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "6px", gridColumn: "1 / -1" }}>
            <span className="flex items-center justify-between gap-[8px]" style={{ fontSize: "12px", color: "var(--foreground-70)" }}>
              {t("pages.adminBanners.form.title")}
              <CharCounter value={draft.title} max={BANNER_LIMITS.title} />
            </span>
            <input
              value={draft.title}
              maxLength={BANNER_LIMITS.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "6px", gridColumn: "1 / -1" }}>
            <span className="flex items-center justify-between gap-[8px]" style={{ fontSize: "12px", color: "var(--foreground-70)" }}>
              {t("pages.adminBanners.form.text")}
              <CharCounter value={draft.text} max={BANNER_LIMITS.text} />
            </span>
            <textarea
              value={draft.text}
              maxLength={BANNER_LIMITS.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              style={textareaStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span className="flex items-center justify-between gap-[8px]" style={{ fontSize: "12px", color: "var(--foreground-70)" }}>
              {t("pages.adminBanners.form.cta")}
              <CharCounter value={draft.ctaText} max={BANNER_LIMITS.cta} />
            </span>
            <input
              value={draft.ctaText}
              maxLength={BANNER_LIMITS.cta}
              onChange={(e) => setDraft((d) => ({ ...d, ctaText: e.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span className="flex items-center justify-between gap-[8px]" style={{ fontSize: "12px", color: "var(--foreground-70)" }}>
              {t("pages.adminBanners.form.untilLabel")}
              <CharCounter value={draft.untilLabel} max={BANNER_LIMITS.untilLabel} />
            </span>
            <input
              value={draft.untilLabel}
              maxLength={BANNER_LIMITS.untilLabel}
              onChange={(e) => setDraft((d) => ({ ...d, untilLabel: e.target.value }))}
              placeholder={t("pages.adminBanners.form.untilPlaceholder")}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "6px", gridColumn: "1 / -1" }}>
            <span className="flex items-center justify-between gap-[8px]" style={{ fontSize: "12px", color: "var(--foreground-70)" }}>
              {t("pages.adminBanners.form.link")}
              <CharCounter value={draft.linkUrl} max={BANNER_LIMITS.linkUrl} />
            </span>
            <input
              value={draft.linkUrl}
              maxLength={BANNER_LIMITS.linkUrl}
              onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))}
              placeholder={t("pages.adminBanners.form.linkPlaceholder")}
              style={inputStyle}
            />
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
          defaultCta={defaultCta}
        />

        <button type="button" onClick={createBanner} disabled={creating} style={{ ...primaryBtn, marginTop: "14px" }}>
          <Plus size={14} className="inline mr-1" />
          {creating ? t("pages.adminBanners.form.creating") : t("pages.adminBanners.form.add")}
        </button>
      </div>

      <div style={{ ...cardStyle, padding: "24px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminBanners.list.title", { count: banners.length })}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminBanners.list.sliderSummary", {
            active: heroBanners.filter((b) => b.isActive).length,
            placement: carouselPlacementLabel,
          })}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {banners.map((b) => {
            const schedule = bannerScheduleStatus(b);
            const placementLabel = placements.find((p) => p.value === b.placement)?.label ?? b.placement;

            return (
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
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>
                        {b.title || t("pages.adminBanners.form.untitled")}
                      </div>
                      <StatusBadge variant={schedule.variant}>
                        {t(`pages.adminBanners.scheduleStatus.${schedule.key}`)}
                      </StatusBadge>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: 2 }}>
                      {placementLabel}
                      {b.startsAt || b.endsAt ? (
                        <span>
                          {" · "}
                          {b.startsAt
                            ? t("pages.adminBanners.list.dateFrom", {
                                date: new Date(`${b.startsAt}T00:00:00`).toLocaleDateString("ru-RU"),
                              })
                            : t("pages.adminBanners.list.dateNoStart")}
                          {b.endsAt
                            ? t("pages.adminBanners.list.dateTo", {
                                date: new Date(`${b.endsAt}T00:00:00`).toLocaleDateString("ru-RU"),
                              })
                            : ""}
                        </span>
                      ) : null}
                    </div>
                    {schedule.key === "scheduled" && (
                      <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: 6 }}>
                        {t("pages.adminBanners.list.scheduledHint")}
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
                  defaultCta={defaultCta}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: "10px", marginTop: "12px" }}>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.title")}</span>
                    <input value={b.title} onChange={(e) => patchBanner(b.id, { title: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.placement")}</span>
                    <select value={b.placement} onChange={(e) => patchBanner(b.id, { placement: e.target.value })} style={inputStyle}>
                      {placements.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.kind")}</span>
                    <select
                      value={b.kind}
                      onChange={(e) => patchBanner(b.id, { kind: e.target.value as AdminBannerRow["kind"] })}
                      style={inputStyle}
                    >
                      <option value="">—</option>
                      {kinds.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "4px", gridColumn: "1 / -1" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.text")}</span>
                    <textarea value={b.text} onChange={(e) => patchBanner(b.id, { text: e.target.value })} style={textareaStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.cta")}</span>
                    <input value={b.ctaText} onChange={(e) => patchBanner(b.id, { ctaText: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.deadline")}</span>
                    <input value={b.untilLabel} onChange={(e) => patchBanner(b.id, { untilLabel: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.link")}</span>
                    <input value={b.linkUrl} onChange={(e) => patchBanner(b.id, { linkUrl: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.priority")}</span>
                    <input type="number" min={0} value={b.priority} onChange={(e) => patchBanner(b.id, { priority: +e.target.value || 0 })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.sortOrder")}</span>
                    <input type="number" min={0} value={b.sortOrder} onChange={(e) => patchBanner(b.id, { sortOrder: +e.target.value || 0 })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.startsAt")}</span>
                    <input type="date" value={b.startsAt} onChange={(e) => patchBanner(b.id, { startsAt: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase" }}>{t("pages.adminBanners.form.endsAt")}</span>
                    <input type="date" value={b.endsAt} onChange={(e) => patchBanner(b.id, { endsAt: e.target.value })} style={inputStyle} />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-[12px] mt-[12px]">
                  <label className="flex items-center gap-[6px] cursor-pointer">
                    <input type="checkbox" checked={b.isActive} onChange={(e) => patchBanner(b.id, { isActive: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                    <span style={{ fontSize: "13px" }}>{t("pages.adminBanners.form.show")}</span>
                  </label>
                  <label className="flex items-center gap-[6px] cursor-pointer">
                    <input type="checkbox" checked={b.isPinned} onChange={(e) => patchBanner(b.id, { isPinned: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                    <span style={{ fontSize: "13px" }}>{t("pages.adminBanners.form.pin")}</span>
                  </label>
                  <label className="flex items-center gap-[6px] cursor-pointer" title={t("pages.adminBanners.form.testShowTitle")}>
                    <input type="checkbox" checked={b.forceVisible} onChange={(e) => patchBanner(b.id, { forceVisible: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                    <span style={{ fontSize: "13px" }}>{t("pages.adminBanners.form.testShow")}</span>
                  </label>
                  <button type="button" onClick={() => onPickImage(b.id)} style={ghostBtn}>{t("pages.adminBanners.form.photo")}</button>
                  {b.imageUrl && (
                    <button type="button" onClick={() => onEditImage(b.id, b.imageUrl!)} style={ghostBtn}>
                      <Pencil size={14} className="inline mr-1" /> {t("pages.adminBanners.form.edit")}
                    </button>
                  )}
                  {(b.forceVisible || schedule.key === "active") && b.placement === "events" && (
                    <Link to="/feed" target="_blank" style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                      <Eye size={14} className="mr-1" /> {t("pages.adminBanners.form.preview")}
                    </Link>
                  )}
                  <button type="button" onClick={() => saveBanner(b)} disabled={savingId === b.id} style={primaryBtn}>
                    {savingId === b.id ? t("pages.adminBanners.form.saving") : t("pages.adminCommon.save")}
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && banners.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--foreground-50)", textAlign: "center", padding: "24px 0" }}>
              {t("pages.adminBanners.list.empty")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
