import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { uploadAdminMedia } from "@/lib/api/admin-media";
import { resolveLucideIcon, useLucideTail } from "@/lib/lucide-icon";
import { LandingCardIcon } from "@/components/landing/LandingCardIcon";
import { IconBox } from "@/components/ui/Icon";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";

/** Common Lucide icons for landing blocks — click to pick. */
export const LANDING_ICON_PRESETS = [
  "Megaphone", "Newspaper", "Users2", "Radio", "MessageSquare", "Clapperboard",
  "Plane", "Ship", "Tank", "Car", "Bot", "Cpu", "Box", "Home", "ShoppingCart",
  "Wrench", "Hammer", "Camera", "Video", "Star", "Heart", "Globe", "MapPin",
  "Truck", "Package", "Rocket", "Zap", "Award", "BookOpen", "Layers",
] as const;

interface Props {
  icon: string;
  iconUrl?: string | null;
  onChange: (patch: { icon?: string; icon_url?: string | null }) => void;
}

const panelStyle: CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "var(--shadow-float)",
};

export function LandingCardIconField({ icon, iconUrl, onChange }: Props) {
  const { t } = useTranslation();
  useLucideTail();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = LANDING_ICON_PRESETS.filter((name) =>
    !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const pickLucide = (name: string) => {
    onChange({ icon: name, icon_url: null });
    setOpen(false);
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("pages.adminLandingIcon.invalidFormat"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("pages.adminLandingIcon.tooLarge"));
      return;
    }
    setUploading(true);
    try {
      const media = await uploadAdminMedia(file, "icon");
      if (!media.url) throw new Error("no url");
      onChange({ icon_url: media.url, icon: icon || "Box" });
      setOpen(false);
      toast.success(t("pages.adminLandingIcon.uploaded"));
    } catch {
      toast.error(t("pages.adminLandingIcon.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative" ref={ref}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.type.startsWith("image/") && f.type !== "image/svg+xml") {
            setEditingFile(f);
          } else {
            void handleUpload(f);
          }
        }}
      />
      <PhotoEditorDialog
        open={editingFile != null}
        src={editingFile}
        title={t("pages.adminLandingIcon.editTitle")}
        onCancel={() => {
          setEditingFile(null);
          if (fileRef.current) fileRef.current.value = "";
        }}
        onSave={(blob) => {
          const file = new File([blob], editingFile?.name ?? "icon.png", { type: blob.type || "image/png" });
          setEditingFile(null);
          void handleUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[10px] rounded-[var(--r-input)] border px-[12px] py-[8px] text-left transition-colors hover:bg-[var(--background-surface)]"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
        aria-expanded={open}
      >
        <IconBox size="md" variant="accent-soft" className="!h-[36px] !w-[36px] !rounded-[8px]">
          <LandingCardIcon icon={icon} iconUrl={iconUrl} fill />
        </IconBox>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            {iconUrl ? t("pages.adminLandingIcon.customIcon") : icon || "Box"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.adminLandingIcon.pickHint")}
          </div>
        </div>
        {iconUrl && (
          <span
            role="button"
            tabIndex={0}
            className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full"
            style={{ color: "var(--foreground-50)" }}
            aria-label={t("pages.adminLandingIcon.removeCustomAria")}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ icon_url: null });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange({ icon_url: null });
              }
            }}
          >
            <X size={14} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden"
            style={panelStyle}
          >
            <div className="flex items-center gap-[8px] border-b px-[12px] py-[10px]" style={{ borderColor: "var(--border)" }}>
              <Search size={14} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("pages.adminLandingIcon.searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--foreground)" }}
              />
            </div>

            <div className="max-h-[200px] overflow-y-auto p-[10px]" style={{ scrollbarWidth: "thin" }}>
              <div className="grid grid-cols-6 gap-[4px] sm:grid-cols-8">
                {filtered.map((name) => {
                  const I = resolveLucideIcon(name);
                  const selected = !iconUrl && icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => pickLucide(name)}
                      className="grid h-[36px] w-full place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"
                      style={{
                        background: selected ? "var(--accent-soft)" : "transparent",
                        color: selected ? "var(--accent)" : "var(--foreground-70)",
                        border: selected ? "1px solid var(--border-accent)" : "1px solid transparent",
                      }}
                    >
                      <I size={18} />
                    </button>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <p className="py-[12px] text-center text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {t("pages.adminLandingIcon.nothingFound")}
                </p>
              )}
            </div>

            <div className="border-t px-[12px] py-[10px]" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-[8px] rounded-[var(--r-button)] py-[10px] text-[13px] font-medium transition-colors hover:bg-[var(--background-surface)] disabled:opacity-60"
                style={{ color: "var(--foreground)" }}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {uploading ? t("pages.adminCommon.loading") : t("pages.adminLandingIcon.uploadLabel")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
