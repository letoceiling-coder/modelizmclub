import { useMemo, useRef, useState, useEffect } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { me } from "@/lib/mock";
import { useCategories } from "@/lib/api/catalog";

const MAX_PHOTOS = 5;

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
}: {
  onCreate?: (p: CreatePostPayload) => void;
  compact?: boolean;
}) {
  const categories = useCategories();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const cat = useMemo(() => categories.find((c) => c.id === catId) ?? categories[0], [catId, categories]);
  const sub = cat?.subcategories.find((s) => s.id === subId);

  useEffect(() => {
    if (categories.length > 0 && !catId) {
      setCatId(categories[0].id);
      setSubId(categories[0].subcategories[0]?.id ?? "");
    }
  }, [categories, catId]);

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
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Что нового в проекте? Поделитесь опытом, фото и деталями сборки…"
        rows={3}
        className="mt-3 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <select
          value={catId}
          onChange={(e) => {
            setCatId(e.target.value);
            const c = categories.find((cc) => cc.id === e.target.value)!;
            setSubId(c.subcategories[0]?.id ?? "");
          }}
          className="rounded-lg border bg-background px-3 py-2 text-xs"
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          disabled={!cat || cat.subcategories.length === 0}
          className="rounded-lg border bg-background px-3 py-2 text-xs disabled:opacity-50"
        >
          {cat.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addPhotos(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Фото {photos.length}/{MAX_PHOTOS}
        </button>
        <button
          onClick={submit}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Send className="h-3.5 w-3.5" /> Опубликовать
        </button>
      </div>
    </div>
  );
}
