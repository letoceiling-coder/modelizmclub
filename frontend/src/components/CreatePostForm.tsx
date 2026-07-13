import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useStore, selectors } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { uploadMedia } from "@/lib/api/media";
import { createPost, publishPost } from "@/lib/api/feed";
import type { Post } from "@/lib/mock";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import type { PostIntent } from "@/components/feed/CreatePostTrigger";

const MAX_PHOTOS = 10;

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
  /** Fired once the post is actually created (and, outside demo mode,
   *  published) on the backend — the real Post the API returned, not a
   *  locally-fabricated stand-in. */
  onCreate?: (p: Post) => void;
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
  const [files, setFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!catId && categories.length > 0) {
      setCatId(categories[0].id);
      setSubId(categories[0].subcategories[0]?.id ?? "");
    }
  }, [categories, catId]);

  const cat = useMemo(() => categories.find((c) => c.id === catId), [categories, catId]);
  const sub = cat?.subcategories.find((s) => s.id === subId);

  const addPhotos = (picked: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const next = picked.slice(0, room);
    const urls = next.map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...urls]);
    setFiles((f) => [...f, ...next]);
  };
  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setFiles((f) => f.filter((_, idx) => idx !== i));
  };
  const reorderPhotos = (next: string[]) => {
    setFiles(next.map((url) => files[photos.indexOf(url)]));
    setPhotos(next);
  };

  const publish = async () => {
    if (!title.trim()) { toast.error("Введите заголовок"); return; }
    if (!text.trim()) { toast.error("Введите текст публикации"); return; }
    if (!cat) { toast.error("Выберите категорию"); return; }
    setPublishing(true);
    try {
      const mediaIds: string[] = [];
      for (const file of files) {
        const m = await uploadMedia(file, "post");
        mediaIds.push(m.uuid);
      }
      let post = await createPost({
        title: title.trim(),
        body: text.trim(),
        categoryId: Number(cat.id),
        mediaIds,
      });
      if (!isDemoMode()) {
        post = await publishPost(post.id);
      }
      onCreate?.(post);
      toast.success("Публикация отправлена на модерацию");
      onClose?.();
    } catch {
      toast.error("Не удалось опубликовать. Попробуйте позже");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
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
        <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pt-[16px]">
          <ImageUploadGrid
            photos={photos}
            max={MAX_PHOTOS}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMakeMain={() => {}}
            onReorder={reorderPhotos}
          />
        </div>
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
              Направление и масштаб
            </span>
            <div className="flex items-center gap-[8px]">
              <ChipSelect
                ariaLabel="Направление"
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
            disabled={publishing}
            className="h-[48px] w-full rounded-[var(--r-button)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {publishing ? "Публикуем…" : "Опубликовать"}
          </button>
        )}
      </div>
    </div>
  );
}
