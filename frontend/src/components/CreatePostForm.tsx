import { useTranslation } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { toast } from "sonner";
import type { Category, Post } from "@/lib/types";
import { fetchPostCategories } from "@/lib/api/catalog";
import { createPost } from "@/lib/api/feed";
import { uploadMedia } from "@/lib/api/media";
import { hasAuthForApi } from "@/lib/api/auth-api";
import { useAuth } from "@/components/auth/AuthProvider";
import { avatarUrl } from "@/lib/utils/time";

const MAX_PHOTOS = 5;

interface Photo {
  url: string;
  uuid?: string;
  uploading?: boolean;
}

export interface CreatePostPayload {
  post: Post;
}

export function CreatePostForm({
  onCreate,
  compact,
}: {
  onCreate?: (p: CreatePostPayload) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { displayName } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState<string>("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchPostCategories().then((items) => {
      setCategories(items);
      if (items[0]) {
        setCatId(items[0].id);
        setSubId(items[0].subcategories?.[0]?.id ?? "");
      }
    }).catch(() => setCategories([]));
  }, []);

  const cat = useMemo(() => categories.find((c) => c.id === catId) ?? categories[0], [categories, catId]);
  const sub = cat?.subcategories?.find((s) => s.id === subId);
  const uploading = photos.some((p) => p.uploading);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    for (const file of list) {
      const url = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { url, uploading: true }]);
      try {
        const media = await uploadMedia(file, "post");
        setPhotos((prev) => prev.map((p) => (p.url === url ? { url: media.url ?? url, uuid: media.uuid } : p)));
      } catch {
        toast.error(t("ads.photoUploadError"));
        setPhotos((prev) => prev.filter((p) => p.url !== url));
      }
    }
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!hasAuthForApi()) return toast.error(t("auth.loginRequired"));
    if (!title.trim()) return toast.error(t("components.createFormTitleRequired"));
    if (!text.trim()) return toast.error(t("components.createFormTextRequired"));
    if (!catId) return toast.error(t("ads.categoryRequired"));
    setSubmitting(true);
    try {
      const post = await createPost({
        title: title.trim(),
        body: text.trim(),
        category_id: Number(catId),
        hashtags: sub?.name ? [sub.name] : [],
        media_ids: photos.map((p) => p.uuid).filter((u): u is string => Boolean(u)),
        publish: true,
      });
      onCreate?.({ post });
      toast.success(post.status === "published" ? t("components.createFormPublished") : t("components.createFormSentModeration"));
      setTitle("");
      setText("");
      setPhotos([]);
    } catch {
      toast.error(t("ads.publishError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`border bg-card ${compact ? "rounded-none border-0" : "rounded-xl"} p-4`}>
      <div className="flex items-center gap-3">
        <img src={avatarUrl(displayName ?? "User")} alt="" className="h-10 w-10 rounded-full" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("components.createFormTitlePlaceholder")}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("components.createFormTextPlaceholder")}
        rows={3}
        className="mt-3 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <select
          value={catId}
          onChange={(e) => {
            setCatId(e.target.value);
            const c = categories.find((cc) => cc.id === e.target.value);
            setSubId(c?.subcategories?.[0]?.id ?? "");
          }}
          className="rounded-lg border bg-background px-3 py-2 text-xs"
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          disabled={!cat || (cat.subcategories?.length ?? 0) === 0}
          className="rounded-lg border bg-background px-3 py-2 text-xs disabled:opacity-50"
        >
          {(cat?.subcategories ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {photos.map((photo, i) => (
            <div key={photo.url} className="relative aspect-square overflow-hidden rounded-lg border">
              <img src={photo.url} alt="" className="h-full w-full object-cover" style={{ opacity: photo.uploading ? 0.5 : 1 }} />
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
          onChange={(e) => void addPhotos(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" /> {t("components.createFormPhotoCount", { current: photos.length, max: MAX_PHOTOS })}
        </button>
        <button
          onClick={() => void submit()}
          disabled={submitting || uploading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />{submitting ? t("ads.publishing") : t("components.createFormPublish")}</button>
      </div>
    </div>
  );
}
