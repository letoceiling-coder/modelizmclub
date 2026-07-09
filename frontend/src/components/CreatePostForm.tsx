import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Send, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useStore, selectors } from "@/lib/store";
import { NativeSelect } from "@/components/ui/native-select";
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

export function CreatePostForm({
  onCreate,
  compact,
  intent,
}: {
  onCreate?: (p: CreatePostPayload) => void;
  compact?: boolean;
  intent?: PostIntent;
}) {
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
    if (intent === "place") {
      setText((cur) => (cur.includes("📍") ? cur : `${cur}${cur ? "\n" : ""}📍 `));
      const t = setTimeout(() => textRef.current?.focus(), 50);
      return () => clearTimeout(t);
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

  const submit = () => {
    if (!title.trim()) return toast.error("Введите заголовок");
    if (!text.trim()) return toast.error("Введите текст публикации");
    if (!cat) return toast.error("Выберите категорию");
    onCreate?.({ title, text, category: cat.name, subcategory: sub?.name, photos });
    toast.success("Публикация отправлена на модерацию");
    setTitle("");
    setText("");
    setPhotos([]);
  };

  return (
    <div className={`border bg-card ${compact ? "rounded-none border-0" : "rounded-xl"} p-4`}>
      <div className="flex items-center gap-3">
        <img src={me.avatar} alt="" className="h-10 w-10 rounded-full" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок публикации"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
        />
      </div>

      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Что нового в проекте? Поделитесь опытом, фото и деталями сборки…"
        rows={3}
        className="mt-3 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      {showEmoji && (
        <div className="mt-2 grid grid-cols-6 gap-1 rounded-lg border bg-background p-2">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              className="grid aspect-square place-items-center rounded-md text-[20px] leading-none transition-colors hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NativeSelect
          aria-label="Категория"
          value={catId}
          onChange={(v) => {
            setCatId(v);
            const c = categories.find((cc) => cc.id === v)!;
            setSubId(c.subcategories[0]?.id ?? "");
          }}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
        />
        <NativeSelect
          aria-label="Подкатегория"
          value={subId}
          onChange={setSubId}
          disabled={!cat || cat.subcategories.length === 0}
          options={(cat?.subcategories ?? []).map((s) => ({ label: s.name, value: s.id }))}
        />
      </div>

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addPhotos(e.target.files)}
        />
        <button
          type="button"
          aria-label={`Добавить фото (${photos.length}/${MAX_PHOTOS})`}
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" /> {photos.length}/{MAX_PHOTOS}
        </button>
        <button
          type="button"
          aria-label="Эмодзи"
          onClick={() => setShowEmoji((v) => !v)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors hover:bg-muted"
          style={{ color: showEmoji ? "var(--accent)" : "var(--foreground-70)" }}
        >
          <Smile className="h-4 w-4" />
        </button>
        <button
          onClick={submit}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Send className="h-4 w-4" /> Опубликовать
        </button>
      </div>
    </div>
  );
}
