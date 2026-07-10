import { useState } from "react";
import { Reorder } from "framer-motion";
import { ImagePlus, X, Star, ImageOff } from "lucide-react";

interface Props {
  photos: string[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeMain: (index: number) => void;
  onReorder: (newPhotos: string[]) => void;
}

/** Single preview tile — a draggable Reorder.Item with a broken-image fallback
 *  (revoked/failed blob URL never shows the browser's default broken glyph). */
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
    <Reorder.Item
      value={src}
      className="relative shrink-0 cursor-grab overflow-hidden active:cursor-grabbing"
      style={{
        width: 104,
        height: 104,
        touchAction: "none",
        background: "var(--background-surface)",
        border: `2px solid ${isMain ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card-sm)",
      }}
      whileDrag={{ scale: 1.05, zIndex: 10, boxShadow: "var(--shadow-float)" }}
    >
      {broken ? (
        <div className="grid h-full w-full place-items-center" style={{ color: "var(--foreground-30)" }}>
          <ImageOff size={22} />
        </div>
      ) : (
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}

      {isMain && (
        <span
          className="absolute left-[6px] top-[6px] inline-flex items-center gap-[3px] px-[8px] py-[3px] text-[10px] font-semibold uppercase"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <Star size={9} fill="currentColor" /> Главное
        </span>
      )}

      <div className="absolute right-[6px] top-[6px] flex gap-[4px]">
        {!isMain && (
          <button
            type="button"
            onClick={() => onMakeMain(index)}
            onPointerDownCapture={(e) => e.stopPropagation()}
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
          onPointerDownCapture={(e) => e.stopPropagation()}
          title="Удалить"
          aria-label="Удалить фото"
          className="grid h-[28px] w-[28px] place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: "var(--r-pill)" }}
        >
          <X size={12} />
        </button>
      </div>
    </Reorder.Item>
  );
}

export function ImageUploadGrid({ photos, max, onAdd, onRemove, onMakeMain, onReorder }: Props) {
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
        <>
          <Reorder.Group
            as="div"
            axis="x"
            values={photos}
            onReorder={onReorder}
            className="flex gap-[12px] overflow-x-auto no-scrollbar py-[2px]"
          >
            {photos.map((src, i) => (
              <PreviewTile key={src} src={src} index={i} onRemove={onRemove} onMakeMain={onMakeMain} />
            ))}
          </Reorder.Group>
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            Перетащите фото, чтобы изменить порядок. Первое — главное в карточке.
          </p>
        </>
      )}
    </div>
  );
}
