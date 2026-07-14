import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X, Newspaper, Star, Megaphone, Tag } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useStore, selectors } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { uploadMedia } from "@/lib/api/media";
import { createPost, publishPost } from "@/lib/api/feed";
import { createChannelPost, POST_KIND_LABEL, type PostKind } from "@/lib/channels";
import type { Post } from "@/lib/mock";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import type { ComposerSelection } from "@/components/feed/CreatePostMenu";

const MAX_PHOTOS = 10;

const POST_KIND_ICON: Record<PostKind, typeof Newspaper> = {
  news: Newspaper,
  review: Star,
  announce: Megaphone,
  promo: Tag,
};

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

export function CreatePostForm({ onCreate, onClose, selection }: {
  /** Fired once the post is actually created (and, outside demo mode,
   *  published) on the backend — the real Post the API returned, not a
   *  locally-fabricated stand-in. Only called for selection.source ===
   *  "profile" — see publish() below for the channel branch. */
  onCreate?: (p: Post) => void;
  onClose?: () => void;
  selection?: ComposerSelection;
}) {
  // selection is only briefly undefined during CreatePostModal's closing
  // CSS transition (content stays mounted while fading out) — this
  // fallback is render-only and never affects a real publish, since the
  // form is unreachable by the user once closing has started.
  const sel: ComposerSelection = selection ?? { kind: "photo", source: "profile" };
  const categories = usePostCategories();
  const me = useStore(selectors.currentUser);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState<string>("");
  const [channelKind, setChannelKind] = useState<PostKind>("news");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!catId && categories.length > 0) {
      setCatId(categories[0].id);
      setSubId(categories[0].subcategories[0]?.id ?? "");
    }
  }, [categories, catId]);

  const cat = useMemo(() => categories.find((c) => c.id === catId), [categories, catId]);

  const addPhotos = (picked: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const next = picked.slice(0, room);
    const urls = next.map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...urls]);
    setPhotoFiles((f) => [...f, ...next]);
  };
  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPhotoFiles((f) => f.filter((_, idx) => idx !== i));
  };
  const reorderPhotos = (next: string[]) => {
    setPhotoFiles(next.map((url) => photoFiles[photos.indexOf(url)]));
    setPhotos(next);
  };

  const publish = async () => {
    if (sel.source === "profile" && !title.trim()) { toast.error("Введите заголовок"); return; }
    if (!text.trim()) { toast.error("Введите текст публикации"); return; }
    if (sel.source === "profile" && !cat) { toast.error("Выберите категорию"); return; }
    setPublishing(true);
    try {
      const mediaIds: string[] = [];
      if (sel.kind === "photo") {
        for (const file of photoFiles) {
          const m = await uploadMedia(file, "post");
          mediaIds.push(m.uuid);
        }
      } else if (videoFile) {
        const m = await uploadMedia(videoFile, "post_video");
        mediaIds.push(m.uuid);
      }

      if (sel.source === "profile") {
        let post = await createPost({
          title: title.trim(),
          body: text.trim(),
          categoryId: Number(cat!.id),
          mediaIds,
        });
        if (!isDemoMode()) {
          post = await publishPost(post.id);
        }
        onCreate?.(post);
        toast.success("Публикация отправлена на модерацию");
      } else {
        await createChannelPost({
          channelSlug: sel.channel!.slug,
          text: text.trim(),
          kind: channelKind,
          mediaIds,
        });
        toast.success("Пост опубликован в канал");
        // No onCreate call — createChannelPost only returns a ChannelPost
        // (channel-scoped view), not the duplicated Post the backend
        // created server-side. Nothing is locally fabricated or prepended
        // to the feed here; the real duplicated Post shows up on the next
        // GET /feed, exactly like today's channel Composer.
      }
      onClose?.();
    } catch {
      toast.error("Не удалось опубликовать. Попробуйте позже");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="flex items-center gap-[8px] border-b px-[8px] py-[8px]"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Закрыть"
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <X className="h-[20px] w-[20px]" />
        </button>
        <h2
          className="min-w-0 flex-1 truncate text-[16px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          Новый пост
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[16px] pt-[14px]">
        {sel.source === "profile" && (
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
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            sel.source === "channel"
              ? `Текст ${POST_KIND_LABEL[channelKind].toLowerCase()}а для подписчиков…`
              : "Расскажите о проекте — опыт, детали сборки, впечатления…"
          }
          className="min-h-[120px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          style={{ color: "var(--foreground)" }}
        />

        {sel.source === "profile" ? (
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
        ) : (
          <div className="flex flex-wrap gap-[6px]">
            {(Object.keys(POST_KIND_LABEL) as PostKind[]).map((k) => {
              const active = channelKind === k;
              const Icon = POST_KIND_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChannelKind(k)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    padding: "7px 11px",
                    borderRadius: 9,
                    background: active ? "var(--accent-soft)" : "var(--background-surface)",
                    color: active ? "var(--accent)" : "var(--foreground-70)",
                    border: active ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)" : "1px solid transparent",
                  }}
                >
                  <Icon size={12} /> {POST_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        )}

        {sel.kind === "photo" ? (
          <ImageUploadGrid
            photos={photos}
            max={MAX_PHOTOS}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMakeMain={() => {}}
            onReorder={reorderPhotos}
            autoOpen
          />
        ) : (
          <VideoUploadField
            fileUrl={videoUrl}
            accept="video/*"
            label="Добавить видео"
            onPick={(file) => {
              setVideoFile(file);
              setVideoUrl(URL.createObjectURL(file));
            }}
            onClear={() => {
              setVideoFile(null);
              setVideoUrl(null);
            }}
            autoOpen
          />
        )}
      </div>

      <div
        className="shrink-0 border-t px-[16px] pt-[10px]"
        style={{ borderColor: "var(--border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={publish}
          disabled={publishing}
          className="h-[48px] w-full rounded-[var(--r-button)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {publishing ? "Публикуем…" : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
