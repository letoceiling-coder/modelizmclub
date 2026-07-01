import { useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, X, Star, ImageOff } from "lucide-react";

interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
}

/** Single preview tile with a broken-image fallback (revoked/failed blob URL
 *  never shows the browser's default broken-image glyph). */
function PreviewTile({
  src,
  index,
  onRemove,
  onMakeMain,
}: {
  src: string;
  index: number;
  onRemove: (i: number) => void;
  onMakeMain: (i: number) => void;
}) {
  const [broken, setBroken] = useState(false);
  const isMain = index === 0;

  return (
    <motion.div
      layout={false}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      className="group relative overflow-hidden"
      style={{
        aspectRatio: "1 / 1",
        background: "var(--background-surface)",
        border: `2px solid ${isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
    >
      {broken ? (
        <div className="grid h-full w-full place-items-center" style={{ color: "var(--foreground-30)" }}>
          <ImageOff size={22} />
        </div>
      ) : (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      )}

      {isMain && (
        <span
          className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <Star size={9} fill="currentColor" /> Главное
        </span>
      )}

      <div className="absolute right-[6px] top-[6px] flex gap-[4px] opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!isMain && (
          <button
            type="button"
            onClick={() => onMakeMain(index)}
            title="Сделать главным"
            aria-label="Сделать главным фото"
            className="grid h-[28px] w-[28px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
          >
            <Star size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(index)}
          title="Удалить"
          aria-label="Удалить фото"
          className="grid h-[28px] w-[28px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <X size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export function ImageUploadGrid({ photos, max, onAdd, onRemove, onMakeMain }: Props) {
  const full = photos.length >= max;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onAdd(files);
    e.target.value = ""; // allow re-picking the same file
  };

  return (
    <div className="space-y-[16px]">
      <label
        className="grid cursor-pointer place-items-center gap-[10px] px-[20px] py-[36px] text-center transition-colors hover:border-[var(--accent)]"
        style={{
          background: "var(--background-elevated)",
          border: "2px dashed var(--border-strong)",
          borderRadius: "var(--r-card)",
          opacity: full ? 0.55 : 1,
          pointerEvents: full ? "none" : "auto",
        }}
      >
        <div
          className="grid h-[56px] w-[56px] place-items-center"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)" }}
        >
          <ImagePlus size={24} />
        </div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
          Перетащите фото или нажмите, чтобы выбрать
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          JPG, PNG до 10 МБ · {photos.length}/{max}
        </div>
        <input type="file" accept="image/*" multiple onChange={handleChange} className="hidden" disabled={full} />
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 md:grid-cols-4">
          {photos.map((src, i) => (
            <PreviewTile key={src} src={src} index={i} onRemove={onRemove} onMakeMain={onMakeMain} />
          ))}
        </div>
      )}
    </div>
  );
}
