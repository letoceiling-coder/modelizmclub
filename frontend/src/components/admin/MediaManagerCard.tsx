import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, Search } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  adminMediaAccept,
  fetchAdminMedia,
  uploadAdminMediaMany,
  type AdminMediaItem,
  type AdminMediaPurpose,
} from "@/lib/api/admin-media";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";

/** Raster (non-SVG) single-file picks are routed through the photo editor
 *  before upload; SVGs and multi-file batches upload as-is. */
function isEditableRasterFile(list: File[]): File | null {
  if (list.length !== 1) return null;
  const f = list[0];
  return f.type.startsWith("image/") && f.type !== "image/svg+xml" ? f : null;
}

const card: CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};

const selectStyle: CSSProperties = {
  height: 38,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
};

const PURPOSES: AdminMediaPurpose[] = ["icon", "banner", "cover", "post", "listing", "avatar"];

function useMediaPurposeLabel() {
  const { t } = useTranslation();
  return useCallback(
    (purpose: string) =>
      t(`pages.adminMedia.purposes.${purpose}`, { defaultValue: purpose }),
    [t],
  );
}

function MediaThumb({ item }: { item: AdminMediaItem }) {
  if (!item.url) {
    return (
      <div
        className="grid h-full w-full place-items-center text-[10px]"
        style={{ color: "var(--foreground-50)" }}
      >
        …
      </div>
    );
  }
  return (
    <img
      src={item.url}
      width={160}
      height={160}
      decoding="async"
      alt=""
      className="h-full w-full object-contain p-1"
      loading="lazy"
    />
  );
}

export function MediaManagerCard() {
  const { t } = useTranslation();
  const purposeLabel = useMediaPurposeLabel();
  const [purpose, setPurpose] = useState<AdminMediaPurpose | "">("");
  const [mime, setMime] = useState<"" | "image" | "svg" | "png" | "jpeg" | "webp">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [uploadPurpose, setUploadPurpose] = useState<AdminMediaPurpose>("icon");
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminMedia({ purpose, mime, page, perPage: 48 });
      setItems(res.items);
      setTotal(res.total);
      setLastPage(res.lastPage);
    } catch {
      toast.error(t("pages.adminMedia.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [purpose, mime, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [purpose, mime]);

  const filtered = query.trim()
    ? items.filter((i) => i.filename.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  async function onUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    try {
      const { uploaded, failed } = await uploadAdminMediaMany(list, uploadPurpose);
      if (uploaded.length > 0) {
        toast.success(
          uploaded.length === 1
            ? t("pages.adminMedia.fileUploaded")
            : t("pages.adminMedia.filesUploaded", { count: uploaded.length }),
        );
        if (uploadPurpose === purpose || purpose === "") {
          setPage(1);
          await load();
        }
      }
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? t("pages.adminMedia.uploadOneFailed", { filename: failed[0].filename, error: failed[0].error })
            : t("pages.adminMedia.uploadManyFailed", { failed: failed.length, total: list.length }),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.adminMedia.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ ...card, padding: 24 }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--foreground)", marginBottom: 4 }}>
        {t("pages.adminMedia.title")}
      </h3>
      <p style={{ fontSize: 12, color: "var(--foreground-50)", marginBottom: 16 }}>
        {t("pages.adminMedia.subtitle")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as AdminMediaPurpose | "")} style={selectStyle}>
          <option value="">{t("pages.adminMedia.allPurposes")}</option>
          {PURPOSES.map((p) => (
            <option key={p} value={p}>{purposeLabel(p)}</option>
          ))}
        </select>
        <select value={mime} onChange={(e) => setMime(e.target.value as typeof mime)} style={selectStyle}>
          <option value="">{t("pages.adminMedia.allFormats")}</option>
          <option value="image">{t("pages.adminMedia.formatImage")}</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
          <option value="svg">SVG</option>
        </select>
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--foreground-50)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pages.adminMedia.searchPlaceholder")}
            style={{ ...selectStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>
        <select value={uploadPurpose} onChange={(e) => setUploadPurpose(e.target.value as AdminMediaPurpose)} style={selectStyle}>
          {PURPOSES.map((p) => (
            <option key={p} value={p}>{t("pages.adminMedia.uploadAs", { purpose: purposeLabel(p) })}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            height: 38,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            background: "var(--accent)",
            color: "var(--accent-foreground)",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {uploading ? t("pages.adminCommon.loading") : t("pages.adminMedia.uploadFiles")}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={adminMediaAccept(uploadPurpose)}
          hidden
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            const editable = isEditableRasterFile(files);
            if (editable) {
              setEditingFile(editable);
            } else if (files.length) {
              void onUpload(files);
            }
          }}
        />
      </div>

      <PhotoEditorDialog
        open={editingFile != null}
        src={editingFile}
        title={t("pages.adminMedia.editImageTitle")}
        onCancel={() => {
          setEditingFile(null);
          if (fileRef.current) fileRef.current.value = "";
        }}
        onSave={(blob) => {
          const name = editingFile?.name ?? "image.jpg";
          const file = new File([blob], name, { type: blob.type || "image/jpeg" });
          setEditingFile(null);
          void onUpload([file]);
        }}
      />

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>
          {t("pages.adminMedia.emptyState")}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
          {filtered.map((item) => (
            <div
              key={item.uuid}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--background)",
              }}
            >
              <div style={{ aspectRatio: "1", background: "var(--background-surface)" }}>
                <MediaThumb item={item} />
              </div>
              <div style={{ padding: "6px 8px" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.filename}
                >
                  {item.filename}
                </div>
                <div style={{ fontSize: 10, color: "var(--foreground-50)", marginTop: 2 }}>
                  {purposeLabel(item.purpose)} · {item.mimeType.replace("image/", "").toUpperCase()}
                </div>
                {item.url && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(item.url!);
                      toast.success(t("pages.adminMedia.urlCopied"));
                    }}
                    style={{ marginTop: 6, fontSize: 10, color: "var(--accent)" }}
                  >
                    {t("pages.adminMedia.copyUrl")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ ...selectStyle, height: 32, opacity: page <= 1 ? 0.5 : 1 }}
          >
            {t("pages.adminMedia.back")}
          </button>
          <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>
            {t("pages.adminMedia.pagination", { page, lastPage, total })}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
            style={{ ...selectStyle, height: 32, opacity: page >= lastPage ? 0.5 : 1 }}
          >
            {t("pages.adminMedia.forward")}
          </button>
        </div>
      )}
    </div>
  );
}

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  purpose?: AdminMediaPurpose;
  title?: string;
  onSelect: (item: AdminMediaItem) => void | Promise<void>;
}

export function MediaPickerDialog({ open, onClose, purpose = "icon", title, onSelect }: MediaPickerDialogProps) {
  const { t } = useTranslation();
  const purposeLabel = useMediaPurposeLabel();
  const [mime, setMime] = useState<"" | "svg" | "png" | "image">("");
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetchAdminMedia({ purpose, mime: mime || undefined, perPage: 100 })
      .then((res) => { if (alive) setItems(res.items); })
      .catch(() => toast.error(t("pages.adminMedia.loadMediaFailed")))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, purpose, mime, t]);

  if (!open) return null;

  async function handleUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    try {
      const { uploaded, failed } = await uploadAdminMediaMany(list, purpose);
      if (uploaded.length > 0) {
        setItems((prev) => [...uploaded, ...prev]);
        toast.success(
          uploaded.length === 1 ? t("pages.adminMedia.fileUploadedShort") : t("pages.adminMedia.filesUploaded", { count: uploaded.length }),
        );
      }
      if (failed.length > 0) {
        toast.error(
          failed.length === 1
            ? t("pages.adminMedia.uploadOneFailed", { filename: failed[0].filename, error: failed[0].error })
            : t("pages.adminMedia.uploadManyFailed", { failed: failed.length, total: list.length }),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.adminMedia.uploadFailedShort"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePick(item: AdminMediaItem) {
    setPicking(item.uuid);
    try {
      await onSelect(item);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.adminMedia.pickFailed"));
    } finally {
      setPicking(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,0.45)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ ...card, width: "min(640px, 100%)", maxHeight: "min(80vh, 720px)", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {title ?? t("pages.adminMedia.pickerDefaultTitle")}
            </h4>
            <p style={{ fontSize: 12, color: "var(--foreground-50)", margin: "4px 0 0" }}>
              {t("pages.adminMedia.pickerFormatsHint", { purpose: purposeLabel(purpose) })}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ fontSize: 20, lineHeight: 1, color: "var(--foreground-50)" }} aria-label={t("pages.adminCommon.close")}>×</button>
        </div>

        <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <select value={mime} onChange={(e) => setMime(e.target.value as typeof mime)} style={selectStyle}>
            <option value="">{t("pages.adminMedia.allFormats")}</option>
            <option value="image">{t("pages.adminMedia.formatImage")}</option>
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              height: 38,
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: 13,
              color: "var(--foreground)",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {t("pages.adminMedia.uploadFiles")}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={adminMediaAccept(purpose)}
            hidden
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void handleUpload(files);
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>
              {t("pages.adminMedia.pickerEmpty")}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
              {items.map((item) => (
                <button
                  key={item.uuid}
                  type="button"
                  disabled={picking === item.uuid}
                  onClick={() => void handlePick(item)}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "var(--background)",
                    opacity: picking === item.uuid ? 0.6 : 1,
                  }}
                >
                  <div style={{ aspectRatio: "1", background: "var(--background-surface)" }}>
                    <MediaThumb item={item} />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      padding: "4px 6px",
                      color: "var(--foreground-70)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.filename}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
