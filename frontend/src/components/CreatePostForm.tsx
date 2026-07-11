import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Plus, X, ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useStore, selectors } from "@/lib/store";
import type { PostIntent } from "@/components/feed/CreatePostTrigger";

const MAX_PHOTOS = 5;

export interface CreatePostPayload {
  title: string;
  text: string;
  category: string;
  subcategory?: string;
  photos: string[];
}

type Step = "photos" | "details";

/** Compact chromed <select> chip for the composer — quieter and auto-width,
 *  unlike the full-width NativeSelect used in forms. */
function ChipSelect({
  value, onChange, options, disabled, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-[44px] w-full cursor-pointer appearance-none truncate rounded-[var(--r-button)] border border-[var(--border)] bg-[var(--background-surface)] pl-[14px] pr-[30px] text-[14px] font-medium text-[var(--foreground)] outline-none transition-colors focus-visible:border-[var(--accent)] disabled:opacity-40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-50)" }}
      />
    </div>
  );
}

export function CreatePostForm({ onCreate, onClose, intent }: {
  onCreate?: (p: CreatePostPayload) => void;
  onClose?: () => void;
  intent?: PostIntent;
}) {
  const categories = usePostCategories();
  const me = useStore(selectors.currentUser);
  const [step, setStep] = useState<Step>("photos");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!catId && categories.length > 0) {
      setCatId(categories[0].id);
      setSubId(categories[0].subcategories[0]?.id ?? "");
    }
  }, [categories, catId]);

  // Photo-first: when opened from the camera icon, pop the system gallery
  // immediately (still within the trigger's user-gesture window).
  useEffect(() => {
    if (intent !== "photo") return;
    const t = setTimeout(() => fileRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, [intent]);

  const cat = useMemo(() => categories.find((c) => c.id === catId), [categories, catId]);
  const sub = cat?.subcategories.find((s) => s.id === subId);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const slots = MAX_PHOTOS - photos.length;
    const next = Array.from(files).slice(0, slots).map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...next]);
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const publish = () => {
    if (!title.trim()) { toast.error("Введите заголовок"); return; }
    if (!text.trim()) { toast.error("Введите текст публикации"); return; }
    if (!cat) { toast.error("Выберите категорию"); return; }
    onCreate?.({ title, text, category: cat.name, subcategory: sub?.name, photos });
    toast.success("Публикация отправлена на модерацию");
    onClose?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />

      {/* Header — step-aware: close on step 1, back on step 2. */}
      <header
        className="flex items-center gap-[8px] border-b px-[8px] py-[8px]"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={() => (step === "details" ? setStep("photos") : onClose?.())}
          aria-label={step === "details" ? "Назад" : "Закрыть"}
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          {step === "details" ? <ArrowLeft className="h-[20px] w-[20px]" /> : <X className="h-[20px] w-[20px]" />}
        </button>
        <h2
          className="min-w-0 flex-1 truncate text-[16px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          {step === "photos" ? "Фото публикации" : "Детали публикации"}
        </h2>
      </header>

      {step === "photos" ? (
        <PhotosStep photos={photos} onPick={() => fileRef.current?.click()} onRemove={removePhoto} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[16px] pt-[14px]">
          {photos.length > 0 && (
            <div className="flex gap-[8px] overflow-x-auto pb-[2px] no-scrollbar">
              {photos.map((src, i) => (
                <div key={i} className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[var(--r-card-sm)] border" style={{ borderColor: "var(--border)" }}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Убрать фото"
                    onClick={() => removePhoto(i)}
                    className="absolute right-[3px] top-[3px] grid h-[18px] w-[18px] place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                  >
                    <X className="h-[11px] w-[11px]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-[12px]">
            <img src={me.avatar} alt="" className="mt-[2px] h-[40px] w-[40px] shrink-0 rounded-full" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок"
              className="min-w-0 flex-1 bg-transparent pt-[8px] text-[16px] font-semibold outline-none placeholder:font-medium"
              style={{ color: "var(--foreground)" }}
            />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Расскажите о проекте — опыт, детали сборки, впечатления…"
            className="min-h-[120px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
            style={{ color: "var(--foreground)" }}
          />

          <div className="flex flex-col gap-[8px]">
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
              Категория и масштаб
            </span>
            <div className="flex items-center gap-[8px]">
              <ChipSelect
                ariaLabel="Категория"
                value={catId}
                onChange={(v) => {
                  setCatId(v);
                  const c = categories.find((cc) => cc.id === v)!;
                  setSubId(c.subcategories[0]?.id ?? "");
                }}
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
              />
              <ChipSelect
                ariaLabel="Подкатегория"
                value={subId}
                onChange={setSubId}
                disabled={!cat || cat.subcategories.length === 0}
                options={(cat?.subcategories ?? []).map((s) => ({ label: s.name, value: s.id }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA — full-width, step-aware. */}
      <div
        className="shrink-0 border-t px-[16px] pt-[10px]"
        style={{ borderColor: "var(--border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {step === "photos" ? (
          <button
            type="button"
            onClick={() => setStep("details")}
            className="h-[48px] w-full rounded-[var(--r-button)] text-[15px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {photos.length > 0 ? "Далее" : "Далее без фото"}
          </button>
        ) : (
          <button
            type="button"
            onClick={publish}
            className="h-[48px] w-full rounded-[var(--r-button)] text-[15px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            Опубликовать
          </button>
        )}
      </div>
    </div>
  );
}

function PhotosStep({ photos, onPick, onRemove }: {
  photos: string[];
  onPick: () => void;
  onRemove: (i: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[16px] py-[24px]">
        <button
          type="button"
          onClick={onPick}
          className="flex w-full max-w-[320px] flex-col items-center gap-[12px] rounded-[var(--r-card)] border-2 border-dashed px-[20px] py-[36px] transition-colors hover:bg-[var(--background-surface)]"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="grid h-[56px] w-[56px] place-items-center rounded-full"
            style={{ background: "var(--background-surface)", color: "var(--accent)" }}
          >
            <ImagePlus className="h-[26px] w-[26px]" />
          </span>
          <span className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            Выбрать из галереи
          </span>
          <span className="text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
            JPG или PNG, до {MAX_PHOTOS} фото. Фото можно и не добавлять.
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pt-[16px]">
      <div className="grid grid-cols-3 gap-[8px]">
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-[var(--r-card-sm)] border" style={{ borderColor: "var(--border)" }}>
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Убрать фото"
              onClick={() => onRemove(i)}
              className="absolute right-[5px] top-[5px] grid h-[24px] w-[24px] place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
            >
              <X className="h-[13px] w-[13px]" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={onPick}
            aria-label="Добавить ещё фото"
            className="grid aspect-square place-items-center rounded-[var(--r-card-sm)] border-2 border-dashed transition-colors hover:bg-[var(--background-surface)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground-50)" }}
          >
            <Plus className="h-[24px] w-[24px]" />
          </button>
        )}
      </div>
    </div>
  );
}
