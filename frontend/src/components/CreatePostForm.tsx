import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ImagePlus, Smile, X, ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useStore, selectors } from "@/lib/store";
import type { PostIntent } from "@/components/feed/CreatePostTrigger";

const MAX_PHOTOS = 5;
const QUICK_EMOJI = ["👍", "🔥", "😍", "🚀", "🛠️", "🏎️", "✈️", "🚁", "⚓", "🎯", "👏", "❤️"];

export interface CreatePostPayload {
  title: string;
  text: string;
  category: string;
  subcategory?: string;
  photos: string[];
}

export interface CreatePostFormHandle {
  /** Validates + creates the post. Returns true on success (caller closes). */
  submit: () => boolean;
}

/** Compact chromed <select> chip for the composer toolbar — quieter and
 *  auto-width, unlike the full-width NativeSelect used in forms. */
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
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-[36px] max-w-[42vw] cursor-pointer appearance-none truncate rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--background-surface)] pl-[12px] pr-[26px] text-[13px] font-medium text-[var(--foreground)] outline-none transition-colors focus-visible:border-[var(--accent)] disabled:opacity-40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-50)" }}
      />
    </div>
  );
}

export const CreatePostForm = forwardRef<CreatePostFormHandle, {
  onCreate?: (p: CreatePostPayload) => void;
  intent?: PostIntent;
}>(function CreatePostForm({ onCreate, intent }, ref) {
  const categories = usePostCategories();
  const me = useStore(selectors.currentUser);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!catId && categories.length > 0) {
      setCatId(categories[0].id);
      setSubId(categories[0].subcategories[0]?.id ?? "");
    }
  }, [categories, catId]);

  // Trigger intents: photo opens the gallery, emoji opens the emoji row.
  // "place" is intentionally gone (it only inserted a 📍 emoji).
  useEffect(() => {
    if (!intent) return;
    if (intent === "photo") {
      const t = setTimeout(() => fileRef.current?.click(), 150);
      return () => clearTimeout(t);
    }
    if (intent === "emoji") {
      setShowEmoji(true);
      textRef.current?.focus();
    }
  }, [intent]);

  const insertEmoji = (e: string) => {
    setText((cur) => cur + e);
    textRef.current?.focus();
  };

  const cat = useMemo(() => categories.find((c) => c.id === catId), [categories, catId]);
  const sub = cat?.subcategories.find((s) => s.id === subId);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const slots = MAX_PHOTOS - photos.length;
    const next = Array.from(files).slice(0, slots).map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...next]);
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const submit = (): boolean => {
    if (!title.trim()) { toast.error("Введите заголовок"); return false; }
    if (!text.trim()) { toast.error("Введите текст публикации"); return false; }
    if (!cat) { toast.error("Выберите категорию"); return false; }
    onCreate?.({ title, text, category: cat.name, subcategory: sub?.name, photos });
    toast.success("Публикация отправлена на модерацию");
    return true;
  };

  useImperativeHandle(ref, () => ({ submit }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Writing surface — the star of the sheet */}
      <div className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto px-[16px] pt-[14px]">
        <div className="flex items-start gap-[12px]">
          <img src={me.avatar} alt="" className="mt-[2px] h-[40px] w-[40px] shrink-0 rounded-full" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="min-w-0 flex-1 bg-transparent pt-[6px] text-[16px] font-semibold outline-none placeholder:font-medium"
            style={{ color: "var(--foreground)" }}
          />
        </div>

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите что-нибудь о проекте — опыт, детали сборки, фото…"
          className="min-h-[160px] w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          style={{ color: "var(--foreground)" }}
        />

        {showEmoji && (
          <div className="grid grid-cols-6 gap-[4px] rounded-[var(--r-card-sm)] border p-[8px]" style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}>
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => insertEmoji(e)}
                className="grid aspect-square place-items-center rounded-[var(--r-card-sm)] text-[20px] leading-none transition-colors hover:bg-[var(--background-surface-hover)]"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {photos.length > 0 && (
          <div className="flex gap-[8px] overflow-x-auto pb-[4px] no-scrollbar">
            {photos.map((src, i) => (
              <div key={i} className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[var(--r-card-sm)] border" style={{ borderColor: "var(--border)" }}>
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Убрать фото"
                  onClick={() => removePhoto(i)}
                  className="absolute right-[4px] top-[4px] grid h-[20px] w-[20px] place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <X className="h-[12px] w-[12px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact toolbar — one quiet line above the keyboard */}
      <div className="flex items-center gap-[6px] border-t px-[10px] py-[8px]" style={{ borderColor: "var(--border)" }}>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
        <button
          type="button"
          aria-label={`Добавить фото (${photos.length}/${MAX_PHOTOS})`}
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)] disabled:opacity-40"
          style={{ color: "var(--foreground-70)" }}
        >
          <ImagePlus className="h-[20px] w-[20px]" />
        </button>
        <button
          type="button"
          aria-label="Эмодзи"
          onClick={() => setShowEmoji((v) => !v)}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: showEmoji ? "var(--accent)" : "var(--foreground-70)" }}
        >
          <Smile className="h-[20px] w-[20px]" />
        </button>

        <div className="ml-auto flex min-w-0 items-center gap-[6px]">
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
  );
});
