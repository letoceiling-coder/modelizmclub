import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Search, RotateCcw, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { isDemoMode } from "@/lib/demo-mode";
import {
  fetchIconAssets,
  deleteIconAsset,
  registerIconFromMedia,
  assetToOverride,
  publishIconOverrides,
  fetchLastPublishedIconOverrides,
  type IconAsset,
  type IconOverrideMap,
} from "@/lib/api/icons";
import {
  getMergedMap,
  setDraftOverride,
  resetDraft,
  applyPublishedMap,
  useDraftChangeCount,
} from "@/lib/icon-overrides";
import { invalidatePublicBootstrap } from "@/lib/api/bootstrap";
import {
  buildAdminSlotEntries,
  GROUP_LABELS,
  PAGE_LABELS,
  TOKEN_OPTIONS,
  type AdminIconSlotEntry,
  type IconPage,
  type IconSlotGroup,
  type TokenKey,
} from "@/lib/icon-slots";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { fetchAdminLandingBlocks } from "@/lib/api/admin";
import { uploadAdminMediaMany } from "@/lib/api/admin-media";
import { MediaPickerDialog } from "@/components/admin/MediaManagerCard";
import { IconSlotPreview } from "@/components/admin/IconSlotPreview";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { Link } from "@tanstack/react-router";

const card: CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};

function slotI18nKey(key: string) {
  return key.replace(/[.:-]/g, "_");
}
function tokenI18nKey(key: TokenKey) {
  return key.replace(/-/g, "_");
}

export function IconManagerSection() {
  const { t } = useTranslation();
  const slotLabel = (key: string, fallback: string) =>
    t(`pages.adminIcons.slots.${slotI18nKey(key)}`, { defaultValue: fallback });
  const pageLabel = (p: IconPage) =>
    t(`pages.adminIcons.pages.${p}`, { defaultValue: PAGE_LABELS[p] });
  const groupLabel = (g: IconSlotGroup) =>
    t(`pages.adminIcons.groups.${g}`, { defaultValue: GROUP_LABELS[g] });
  const tokenLabel = (key: TokenKey, fallback: string) =>
    t(`pages.adminIcons.tokens.${tokenI18nKey(key)}`, { defaultValue: fallback });

  const categories = usePostCategories();
  const [landingCards, setLandingCards] = useState<
    { id: number; title: string; icon: string; icon_url?: string | null; section_slug: string }[]
  >([]);
  const [assets, setAssets] = useState<IconAsset[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("nav.feed");
  const [search, setSearch] = useState("");
  const [expandedPage, setExpandedPage] = useState<IconPage | "all">("all");
  const [assetId, setAssetId] = useState("");
  const [token, setToken] = useState<TokenKey>("foreground");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [canRollback, setCanRollback] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftCount = useDraftChangeCount();

  useEffect(() => {
    let alive = true;
    fetchIconAssets()
      .then((a) => alive && setAssets(a))
      .catch(() => {});
    fetchLastPublishedIconOverrides()
      .then((prev) => alive && setCanRollback(prev !== null))
      .catch(() => {});
    fetchAdminLandingBlocks()
      .then(({ cards }) => alive && setLandingCards(cards))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const allSlots = useMemo(
    () =>
      buildAdminSlotEntries({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          iconImageUrl: c.iconImageUrl,
        })),
        landingCards,
      }),
    [categories, landingCards],
  );

  const selected = allSlots.find((s) => s.key === selectedKey) ?? allSlots[0];

  const filteredSlots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSlots.filter((s) => {
      if (expandedPage !== "all" && s.page !== expandedPage) return false;
      if (!q) return true;
      return s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q);
    });
  }, [allSlots, search, expandedPage]);

  const slotsByPage = useMemo(() => {
    const map = new Map<IconPage, AdminIconSlotEntry[]>();
    for (const s of filteredSlots) {
      const list = map.get(s.page) ?? [];
      list.push(s);
      map.set(s.page, list);
    }
    return map;
  }, [filteredSlots]);

  useEffect(() => {
    if (selected) {
      setToken(selected.defaultToken);
      const merged = getMergedMap()[selected.key];
      setAssetId(merged?.assetId ?? "");
    }
  }, [selected?.key]);

  function renderAssetThumb(a: IconAsset, size = 22) {
    if (a.format === "png" && a.url) {
      return (
        <img
          src={a.url}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          alt=""
          aria-hidden
          style={{ width: size, height: size, objectFit: "contain" }}
        />
      );
    }
    if (a.svg && isSafeSvgMarkup(a.svg)) {
      return (
        <span
          aria-hidden
          style={{ width: size, height: size, display: "inline-flex" }}
          dangerouslySetInnerHTML={{ __html: a.svg }}
        />
      );
    }
    return null;
  }

  async function onUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    try {
      const { uploaded, failed } = await uploadAdminMediaMany(list, "icon");
      const newAssets: typeof assets = [];
      for (const media of uploaded) {
        try {
          newAssets.push(await registerIconFromMedia(media.uuid));
        } catch {
          failed.push({
            filename: media.filename,
            error: t("pages.adminIcons.toasts.addToLibraryFailed"),
          });
        }
      }
      if (newAssets.length > 0) {
        setAssets((prev) => [...newAssets, ...prev]);
        setAssetId(newAssets[0].id);
        toast.success(
          newAssets.length === 1
            ? t("pages.adminIcons.toasts.iconUploaded")
            : t("pages.adminIcons.toasts.iconsUploaded", { count: newAssets.length }),
        );
      }
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? t("pages.adminIcons.toasts.uploadErrorSingle", {
                filename: failed[0].filename,
                error: failed[0].error,
              })
            : t("pages.adminIcons.toasts.uploadErrors", {
                failed: failed.length,
                total: list.length,
              }),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.adminIcons.toasts.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onPickFromMedia(item: { uuid: string }) {
    const existing = assets.find((a) => a.mediaUuid === item.uuid);
    if (existing) {
      setAssetId(existing.id);
      return;
    }
    const asset = await registerIconFromMedia(item.uuid);
    setAssets((prev) => [asset, ...prev]);
    setAssetId(asset.id);
    toast.success(t("pages.adminIcons.toasts.iconAddedFromMedia"));
  }

  async function onDeleteAsset(id: string) {
    try {
      await deleteIconAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (assetId === id) setAssetId("");
    } catch {
      toast.error(t("pages.adminIcons.toasts.deleteFailed"));
    }
  }

  function onApply() {
    if (!selected) return;
    if (assetId === "") {
      setDraftOverride(selected.key, null);
      toast(t("pages.adminIcons.toasts.resetToDefaultPreview"));
      return;
    }
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setDraftOverride(selected.key, assetToOverride(asset, token));
    toast(t("pages.adminIcons.toasts.previewApplied"));
  }

  function buildPublishMap(): IconOverrideMap {
    return getMergedMap();
  }

  async function onPublish() {
    setPublishing(true);
    try {
      const map = buildPublishMap();
      await publishIconOverrides(map);
      applyPublishedMap(map, "publish");
      invalidatePublicBootstrap();
      setCanRollback(true);
      toast.success(
        isDemoMode()
          ? t("pages.adminIcons.toasts.publishedDemo")
          : t("pages.adminIcons.toasts.publishedAll"),
      );
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.adminIcons.toasts.publishFailed")));
    } finally {
      setPublishing(false);
    }
  }

  async function onRollback() {
    try {
      const prev = await fetchLastPublishedIconOverrides();
      if (prev === null) {
        setCanRollback(false);
        return;
      }
      await publishIconOverrides(prev);
      applyPublishedMap(prev, "publish");
      invalidatePublicBootstrap();
      toast.success(t("pages.adminIcons.toasts.rollbackDone"));
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.adminIcons.toasts.rollbackFailed")));
    }
  }

  const selectStyle: CSSProperties = {
    height: 38,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: 13,
    width: "100%",
  };

  if (!selected) {
    return (
      <div style={{ padding: 24, color: "var(--foreground-50)" }}>
        {t("pages.adminIcons.loadingSlots")}
      </div>
    );
  }

  const hasOverride = Boolean(getMergedMap()[selected.key]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--foreground)",
            }}
          >
            {t("pages.adminIcons.title")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 4, maxWidth: 560 }}>
            {t("pages.adminIcons.subtitle")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {draftCount > 0 && (
            <span
              style={{
                fontSize: 12,
                padding: "8px 12px",
                borderRadius: 10,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                alignSelf: "center",
              }}
            >
              {t("pages.adminIcons.changesCount", { count: draftCount })}
            </span>
          )}
          <button
            type="button"
            disabled={publishing}
            onClick={onPublish}
            style={{
              padding: "9px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              opacity: publishing ? 0.6 : 1,
            }}
          >
            {publishing ? t("pages.adminIcons.publishing") : t("pages.adminIcons.publishAll")}
          </button>
          <button
            type="button"
            onClick={() => {
              resetDraft();
              toast(t("pages.adminIcons.toasts.previewReset"));
            }}
            style={{
              padding: "9px 16px",
              borderRadius: 10,
              fontSize: 13,
              border: "1px solid var(--border)",
              color: "var(--foreground-70)",
            }}
          >
            {t("pages.adminIcons.resetPreview")}
          </button>
          {canRollback && (
            <button
              type="button"
              onClick={onRollback}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                fontSize: 13,
                border: "1px solid var(--border)",
                color: "var(--foreground-70)",
              }}
            >
              {t("pages.adminIcons.rollback")}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 300px) 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Tree */}
        <div style={{ ...card, padding: 12, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: 11, color: "var(--foreground-50)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("pages.adminIcons.searchPlaceholder")}
              style={{ ...selectStyle, paddingLeft: 32 }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            <FilterChip
              active={expandedPage === "all"}
              onClick={() => setExpandedPage("all")}
              label={t("pages.adminIcons.filterAll")}
            />
            {(Object.keys(PAGE_LABELS) as IconPage[]).map((p) => (
              <FilterChip
                key={p}
                active={expandedPage === p}
                onClick={() => setExpandedPage(p)}
                label={pageLabel(p)}
              />
            ))}
          </div>
          {(Object.keys(PAGE_LABELS) as IconPage[]).map((page) => {
            const items = slotsByPage.get(page);
            if (!items?.length) return null;
            return (
              <div key={page} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--foreground-50)",
                    marginBottom: 6,
                  }}
                >
                  {pageLabel(page)}
                </div>
                {items.map((s) => {
                  const active = s.key === selectedKey;
                  const changed =
                    Boolean(getMergedMap()[s.key]) && getMergedMap()[s.key] !== undefined;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSelectedKey(s.key)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        marginBottom: 2,
                        borderRadius: 8,
                        fontSize: 13,
                        border: "none",
                        cursor: "pointer",
                        background: active ? "var(--accent-soft)" : "transparent",
                        color: active ? "var(--accent)" : "var(--foreground)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {slotLabel(s.key, s.label)}
                      {changed && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)" }}>
                          ●
                        </span>
                      )}
                      <span
                        style={{
                          display: "block",
                          fontSize: 10,
                          color: "var(--foreground-50)",
                          marginTop: 2,
                        }}
                      >
                        {groupLabel(s.group)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Editor */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--foreground-50)", marginBottom: 4 }}>
            {pageLabel(selected.page)} · {groupLabel(selected.group)}
          </div>
          <h3
            style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 16 }}
          >
            {slotLabel(selected.key, selected.label)}
          </h3>

          <IconSlotPreview slot={selected} label={slotLabel(selected.key, selected.label)} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--foreground-70)",
                  marginBottom: 8,
                }}
              >
                {t("pages.adminIcons.currentDefault")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--background-surface)",
                }}
              >
                <IconSlotPreview slot={selected} label="" size={28} forceDefault />
                <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>
                  {selected.defaultLucide}
                  {selected.defaultImageUrl ? " / PNG" : ""}
                </span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--foreground-70)",
                  marginBottom: 8,
                }}
              >
                {t("pages.adminIcons.previewWithChanges")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${hasOverride ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--background-surface)",
                }}
              >
                <IconSlotPreview slot={selected} label="" size={28} />
                <span
                  style={{
                    fontSize: 12,
                    color: hasOverride ? "var(--accent)" : "var(--foreground-50)",
                  }}
                >
                  {hasOverride ? t("pages.adminIcons.custom") : t("pages.adminIcons.asDefault")}
                </span>
              </div>
            </div>
          </div>

          {/* Library mini */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--foreground-70)",
                marginBottom: 8,
              }}
            >
              {t("pages.adminIcons.iconLibrary")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => setAssetId("")}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  border: `1px solid ${assetId === "" ? "var(--accent)" : "var(--border)"}`,
                  fontSize: 10,
                  color: "var(--foreground-50)",
                }}
              >
                {t("pages.adminIcons.default")}
              </button>
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  onClick={() => setAssetId(a.id)}
                  style={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    border: `1px solid ${assetId === a.id ? "var(--accent)" : "var(--border)"}`,
                    color: "var(--foreground)",
                  }}
                >
                  {renderAssetThumb(a, 24)}
                </button>
              ))}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  border: "1px dashed var(--border)",
                  color: "var(--foreground-50)",
                }}
              >
                <Upload size={16} />
              </button>
              {!isDemoMode() && (
                <button
                  type="button"
                  onClick={() => setMediaPickerOpen(true)}
                  style={{
                    height: 48,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px dashed var(--border)",
                    fontSize: 11,
                    color: "var(--foreground-50)",
                  }}
                >
                  {t("pages.adminIcons.fromMedia")}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/svg+xml,.svg,image/png,.png"
              hidden
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length === 1 && files[0].type === "image/png") {
                  setEditingFile(files[0]);
                } else if (files.length) {
                  void onUpload(files);
                }
              }}
            />
          </div>

          {selected.supportsRecolor && (
            <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>
                {t("pages.adminIcons.colorForSvg")}
              </span>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value as TokenKey)}
                style={selectStyle}
              >
                {TOKEN_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {tokenLabel(opt.key, opt.label)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!selected.supportsRecolor && (
            <p style={{ fontSize: 12, color: "var(--foreground-50)", marginBottom: 12 }}>
              {t("pages.adminIcons.pngNoRecolor")}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onApply}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--accent)",
                color: "var(--accent)",
                background: "var(--accent-soft)",
              }}
            >
              {t("pages.adminIcons.applyPreview")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAssetId("");
                onApply();
              }}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                fontSize: 13,
                border: "1px solid var(--border)",
                color: "var(--foreground-70)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={14} /> {t("pages.adminIcons.resetSlot")}
            </button>
          </div>

          {selected.group === "landing" && (
            <p style={{ fontSize: 12, color: "var(--foreground-50)", marginTop: 16 }}>
              {t("pages.adminIcons.landingCardHintPrefix")}{" "}
              <Link
                to="/admin"
                search={{ section: "landingBlocks" }}
                style={{ color: "var(--accent)" }}
              >
                {t("pages.adminIcons.landingCardLink")}
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <MediaPickerDialog
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        purpose="icon"
        title={t("pages.adminIcons.mediaPickerTitle")}
        onSelect={onPickFromMedia}
      />

      <PhotoEditorDialog
        open={editingFile != null}
        src={editingFile}
        title={t("pages.adminIcons.photoEditorTitle")}
        onCancel={() => {
          setEditingFile(null);
          if (fileRef.current) fileRef.current.value = "";
        }}
        onSave={(blob) => {
          const file = new File([blob], editingFile?.name ?? "icon.png", {
            type: blob.type || "image/png",
          });
          setEditingFile(null);
          void onUpload([file]);
        }}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        border: "none",
        cursor: "pointer",
        background: active ? "var(--accent-soft)" : "var(--background-surface)",
        color: active ? "var(--accent)" : "var(--foreground-50)",
      }}
    >
      {label}
    </button>
  );
}
