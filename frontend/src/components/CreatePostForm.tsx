import { useEffect, useMemo, useRef, useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useTranslation } from "react-i18next";
import { ChevronDown, X, Newspaper, Star, Megaphone, Tag, FileText } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useCurrentUser } from "@/lib/session";
import { isDemoMode } from "@/lib/demo-mode";
import {
  uploadMediaDeduped,
  validatePostVideoFile,
  beginPresignedUpload,
  type PresignedUploadHandle,
} from "@/lib/api/media";
import { createPost, publishPost, schedulePost } from "@/lib/api/feed";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import {
  buildSchedulePayload,
  isScheduleDateTimeValid,
  type PublishMode,
} from "@/lib/post-schedule";
import { PostSchedulePicker, useInitialScheduleState } from "@/components/feed/PostSchedulePicker";
import { createChannelPost, POST_KIND_LABEL, type PostKind } from "@/lib/channels";
import type { Post } from "@/lib/mock";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import type { ComposerDraft, ComposerSelection } from "@/components/feed/CreatePostMenu";
import { clampPostTitle, POST_TITLE_MAX_LENGTH } from "@/lib/post-limits";
import {
  clearPostDraft,
  dataUrlToFile,
  fileToDataUrl,
  isDraftMeaningful,
  readPostDraft,
  writePostDraft,
  type DraftPhoto,
  type PersistedPostDraft,
} from "@/lib/post-draft";

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
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
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

export function CreatePostForm({
  onCreate,
  onClose,
  selection,
  initialDraft,
  communityId,
}: {
  /** Fired once the post is actually created (and, outside demo mode,
   *  published) on the backend — the real Post the API returned, not a
   *  locally-fabricated stand-in. Only called for selection.source ===
   *  "profile" — see publish() below for the channel branch. */
  onCreate?: (p: Post) => void;
  onClose?: () => void;
  selection?: ComposerSelection;
  initialDraft?: ComposerDraft;
  /** When set, the post is scoped to this community (numeric backend id). */
  communityId?: number;
}) {
  // selection is only briefly undefined during CreatePostModal's closing
  // CSS transition (content stays mounted while fading out) — this
  // fallback is render-only and never affects a real publish, since the
  // form is unreachable by the user once closing has started.
  const sel: ComposerSelection = selection ?? { kind: "photo", source: "profile" };
  const { t } = useTranslation();
  const categories = usePostCategories();
  const me = useCurrentUser();
  const { requirePremium } = useGuestAccess();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [catId, setCatId] = useState("");
  const [subId, setSubId] = useState<string>("");
  const [channelKind, setChannelKind] = useState<PostKind>("news");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photosRef = useRef(photos);
  const photoFilesRef = useRef(photoFiles);
  photosRef.current = photos;
  photoFilesRef.current = photoFiles;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const videoUploadRef = useRef<Promise<PresignedUploadHandle> | null>(null);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<PersistedPostDraft | null>(null);
  const scheduleDefaults = useInitialScheduleState();
  const [publishMode, setPublishMode] = useState<PublishMode>(scheduleDefaults.mode);
  const [scheduleDate, setScheduleDate] = useState(scheduleDefaults.date);
  const [scheduleTime, setScheduleTime] = useState(scheduleDefaults.time);
  const [scheduleTimezone, setScheduleTimezone] = useState(scheduleDefaults.timezone);
  // Cache File -> serialised photo so autosave doesn't re-read blobs each keystroke.
  const photoDraftCache = useRef<Map<File, DraftPhoto>>(new Map());
  const draftEnabled = sel.source === "profile";

  // Direction and scale are optional (VK-style): nothing is preselected, and
  // an empty pick publishes a post with no category at all.

  // On open, offer to restore a persisted draft (unless an in-session draft
  // was passed in from the inline composer).
  useEffect(() => {
    if (!draftEnabled) return;
    const hasInitial = Boolean(
      initialDraft && (initialDraft.text?.trim() || initialDraft.files.length),
    );
    if (hasInitial) return;
    const stored = readPostDraft();
    if (stored && isDraftMeaningful(stored)) setDraftPrompt(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the draft while the user composes. Held back while the restore
  // prompt is still shown (user hasn't chosen yet) and while publishing.
  useEffect(() => {
    if (!draftEnabled || draftPrompt || publishing) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const photos: DraftPhoto[] = [];
      if (sel.kind === "photo") {
        for (const f of photoFiles) {
          let dp = photoDraftCache.current.get(f);
          if (!dp) {
            try {
              dp = { name: f.name, type: f.type, dataUrl: await fileToDataUrl(f) };
              photoDraftCache.current.set(f, dp);
            } catch {
              dp = undefined;
            }
          }
          if (dp) photos.push(dp);
        }
      }
      if (cancelled) return;
      writePostDraft({ title, text, catId, subId, photos, savedAt: Date.now() });
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [draftEnabled, draftPrompt, publishing, title, text, catId, subId, photoFiles, sel.kind]);

  const restoreDraft = async () => {
    const d = draftPrompt;
    if (!d) return;
    setTitle(clampPostTitle(d.title));
    setText(d.text);
    if (d.catId) setCatId(d.catId);
    if (d.subId) setSubId(d.subId);
    if (sel.kind === "photo" && d.photos.length) {
      try {
        const files = await Promise.all(d.photos.map(dataUrlToFile));
        const urls = files.map((f) => URL.createObjectURL(f));
        files.forEach((f, i) => photoDraftCache.current.set(f, d.photos[i]));
        setPhotoFiles(files);
        setPhotos(urls);
      } catch {
        /* ignore — restore text only */
      }
    }
    if (d.photosDropped) toast.error(t("components.createPostForm.photosRestoreFailed"));
    setDraftPrompt(null);
  };

  const discardDraft = () => {
    clearPostDraft();
    setDraftPrompt(null);
  };

  useEffect(() => {
    if (!initialDraft) return;
    if (initialDraft.text) setText(initialDraft.text);
    if (!initialDraft.files.length) return;

    const images = initialDraft.files.filter((f) => f.type.startsWith("image/"));
    const video = initialDraft.files.find((f) => f.type.startsWith("video/"));

    if (sel.kind === "photo" && images.length) {
      const urls = images.map((f) => URL.createObjectURL(f));
      setPhotos(urls);
      setPhotoFiles(images);
    } else if (sel.kind === "video" && video) {
      setVideoFile(video);
      setVideoUrl(URL.createObjectURL(video));
      setVideoProgress(0);
      videoUploadRef.current = beginPresignedUpload(video, "post_video", setVideoProgress);
      void videoUploadRef.current
        .then((h) => h.done)
        .catch(() => {
          setVideoProgress(null);
          toast.error(t("components.createPostForm.publishFailed"));
        });
    }
  }, [initialDraft, sel.kind]);

  const cat = useMemo(() => categories.find((c) => c.id === catId), [categories, catId]);

  const addPhotos = (picked: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const next = picked.slice(0, room);
    const urls = next.map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...urls]);
    setPhotoFiles((f) => [...f, ...next]);
    for (const file of next) {
      void uploadMediaDeduped(file, "post").catch(() => {});
    }
  };
  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPhotoFiles((f) => f.filter((_, idx) => idx !== i));
  };
  const reorderPhotos = (next: string[]) => {
    const currentPhotos = photosRef.current;
    const currentFiles = photoFilesRef.current;
    setPhotoFiles(next.map((url) => currentFiles[currentPhotos.indexOf(url)]));
    setPhotos(next);
  };
  const replacePhoto = (i: number, blob: Blob) => {
    const oldUrl = photos[i];
    const oldFile = photoFiles[i];
    const newFile = new File([blob], oldFile?.name ?? `photo-${i}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    const newUrl = URL.createObjectURL(blob);
    setPhotos((p) => p.map((u, idx) => (idx === i ? newUrl : u)));
    setPhotoFiles((f) => f.map((file, idx) => (idx === i ? newFile : file)));
    if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
    void uploadMediaDeduped(newFile, "post").catch(() => {});
  };

  const publish = async () => {
    if (sel.source === "profile" && !title.trim()) {
      toast.error(t("components.createPostForm.titleRequired"));
      return;
    }
    if (sel.source === "profile" && title.trim().length > POST_TITLE_MAX_LENGTH) {
      toast.error(t("components.createPostForm.titleTooLong", { max: POST_TITLE_MAX_LENGTH }));
      return;
    }
    if (!text.trim()) {
      toast.error(t("components.createPostForm.textRequired"));
      return;
    }
    if (sel.kind === "video" && !videoFile) {
      toast.error(t("components.createPostForm.videoRequired"));
      return;
    }
    if (sel.kind === "video" && videoFile) {
      const videoErr = validatePostVideoFile(videoFile);
      if (videoErr) {
        toast.error(videoErr);
        return;
      }
    }
    requirePremium(() => {
      void runPublish();
    });
  };

  const runPublish = async () => {
    setPublishing(true);
    try {
      const mediaIds: string[] = [];
      if (sel.kind === "photo") {
        for (const file of photoFiles) {
          const m = await uploadMediaDeduped(file, "post");
          mediaIds.push(m.uuid);
        }
      } else if (videoFile) {
        const handle = await (videoUploadRef.current ??
          beginPresignedUpload(videoFile, "post_video", setVideoProgress));
        videoUploadRef.current = Promise.resolve(handle);
        mediaIds.push(handle.uuid);
        void handle.done.catch(() => {
          toast.error(t("components.createPostForm.videoFailed"));
        });
      }

      if (sel.source === "profile") {
        // «Масштаб» is a child node of «Направление» in the same post-category
        // tree, so the deepest pick is what gets stored — the feed's direction
        // filter still matches it through the taxonomy's descendants.
        const taxonomyId = subId || catId;
        let post = await createPost({
          title: title.trim(),
          body: text.trim(),
          categoryId: taxonomyId ? Number(taxonomyId) : undefined,
          communityId,
          mediaIds,
        });
        if (!isDemoMode()) {
          if (publishMode === "schedule") {
            if (!isScheduleDateTimeValid(scheduleDate, scheduleTime)) {
              toast.error(t("components.postSchedule.invalidDateTime"));
              return;
            }
            post = await schedulePost(
              post.id,
              buildSchedulePayload(scheduleDate, scheduleTime, scheduleTimezone),
            );
            toast.success(t("components.createPostForm.scheduled"));
          } else {
            post = await publishPost(post.id);
            toast.success(
              sel.kind === "video"
                ? t("components.createPostForm.videoQueued")
                : t("components.createPostForm.sentToModeration"),
            );
          }
        } else if (publishMode === "schedule") {
          post = { ...post, status: "scheduled", scheduledAt: new Date().toISOString() };
          toast.success(t("components.createPostForm.scheduled"));
        } else {
          toast.success(
            sel.kind === "video"
              ? t("components.createPostForm.videoQueued")
              : t("components.createPostForm.sentToModeration"),
          );
        }
        onCreate?.(post);
      } else {
        await createChannelPost({
          channelSlug: sel.channel!.slug,
          text: text.trim(),
          kind: channelKind,
          mediaIds,
        });
        toast.success(
          sel.kind === "video"
            ? t("components.createPostForm.videoQueued")
            : t("components.createPostForm.publishedToChannel"),
        );
        // No onCreate call — createChannelPost only returns a ChannelPost
        // (channel-scoped view), not the duplicated Post the backend
        // created server-side. Nothing is locally fabricated or prepended
        // to the feed here; the real duplicated Post shows up on the next
        // GET /feed, exactly like today's channel Composer.
      }
      clearPostDraft();
      onClose?.();
    } catch (err) {
      const message = formatApiErrorMessage(err, t("components.createPostForm.publishFailed"));
      if (message) toast.error(message);
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
          aria-label={t("components.createPostForm.close")}
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <X className="h-[20px] w-[20px]" />
        </button>
        <h2
          className="min-w-0 flex-1 truncate text-[16px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          {t("components.createPostForm.newPost")}
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[16px] pt-[14px]">
        {draftPrompt && (
          <div
            role="region"
            aria-label={t("components.createPostForm.draftFound")}
            className="flex flex-wrap items-center gap-x-[8px] gap-y-[6px] rounded-[var(--r-card-sm)] border px-[10px] py-[8px] sm:px-[12px] sm:py-[10px]"
            style={{
              borderColor: "color-mix(in oklab, var(--accent) 35%, transparent)",
              background: "var(--accent-soft)",
            }}
          >
            <FileText
              size={15}
              className="shrink-0"
              style={{ color: "var(--accent)" }}
              aria-hidden
            />
            <p
              className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight sm:text-[13px]"
              style={{ color: "var(--foreground)" }}
            >
              {t("components.createPostForm.draftFound")}
            </p>
            <div className="flex w-full shrink-0 items-center gap-[6px] sm:ml-auto sm:w-auto">
              <button
                type="button"
                onClick={restoreDraft}
                className="h-[32px] min-w-[44px] flex-1 rounded-[var(--r-button)] px-[12px] text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:flex-none sm:h-[34px] sm:px-[14px] sm:text-[13px]"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {t("components.createPostForm.continueDraft")}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="h-[32px] min-w-[44px] flex-1 rounded-[var(--r-button)] border px-[12px] text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:flex-none sm:h-[34px] sm:px-[14px] sm:text-[13px]"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground-70)",
                  background: "var(--background-elevated)",
                }}
              >
                {t("components.createPostForm.startNew")}
              </button>
            </div>
          </div>
        )}
        {sel.source === "profile" && (
          <div className="space-y-[4px]">
            <div className="flex items-start gap-[12px]">
              <UserAvatar src={me.avatar} name={me.name} size={40} />
              <input
                value={title}
                maxLength={POST_TITLE_MAX_LENGTH}
                onChange={(e) => setTitle(clampPostTitle(e.target.value))}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const input = e.currentTarget;
                  const start = input.selectionStart ?? title.length;
                  const end = input.selectionEnd ?? title.length;
                  setTitle(clampPostTitle(title.slice(0, start) + pasted + title.slice(end)));
                }}
                placeholder={t("components.createPostForm.titlePlaceholder")}
                aria-describedby="post-title-counter"
                className="min-w-0 flex-1 bg-transparent pt-[8px] text-[16px] font-semibold outline-none placeholder:font-medium focus-visible:ring-0"
                style={{ color: "var(--foreground)" }}
              />
            </div>
            <p
              id="post-title-counter"
              className="text-right text-[11px] tabular-nums"
              style={{
                color:
                  title.length >= POST_TITLE_MAX_LENGTH - 10
                    ? "rgb(217,119,6)"
                    : "var(--foreground-50)",
                paddingLeft: 52,
              }}
            >
              {t("components.createPostForm.titleCounter", {
                current: title.length,
                max: POST_TITLE_MAX_LENGTH,
              })}
            </p>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            sel.source === "channel"
              ? t("components.createPostForm.channelTextPlaceholder", {
                  kind: POST_KIND_LABEL[channelKind].toLowerCase(),
                })
              : t("components.createPostForm.profileTextPlaceholder")
          }
          className="min-h-[120px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          style={{ color: "var(--foreground)" }}
        />

        {sel.source === "profile" ? (
          <div className="flex flex-col gap-[8px]">
            <span
              className="text-[12px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-50)" }}
            >
              {t("components.createPostForm.directionAndScaleOptional")}
            </span>
            <div className="flex items-center gap-[8px]">
              <ChipSelect
                ariaLabel={t("components.createPostForm.directionLabel")}
                value={catId}
                onChange={(v) => {
                  setCatId(v);
                  setSubId("");
                }}
                options={[
                  { label: t("components.createPostForm.directionAny"), value: "" },
                  ...categories.map((c) => ({ label: c.name, value: c.id })),
                ]}
              />
              <ChipSelect
                ariaLabel={t("components.createPostForm.subcategoryLabel")}
                value={subId}
                onChange={setSubId}
                disabled={!cat || cat.subcategories.length === 0}
                options={[
                  { label: t("components.createPostForm.scaleAny"), value: "" },
                  ...(cat?.subcategories ?? []).map((s) => ({ label: s.name, value: s.id })),
                ]}
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
                    border: active
                      ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)"
                      : "1px solid transparent",
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
            controls="minimal"
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMakeMain={() => {}}
            onReorder={reorderPhotos}
            onEdit={(i) => setEditingPhotoIndex(i)}
          />
        ) : (
          <VideoUploadField
            fileUrl={videoUrl}
            accept="video/mp4,video/webm,.mp4,.webm"
            label={t("components.createPostForm.addVideo")}
            onPick={(file) => {
              const err = validatePostVideoFile(file);
              if (err) {
                toast.error(err);
                return;
              }
              setVideoFile(file);
              setVideoUrl(URL.createObjectURL(file));
              setVideoProgress(0);
              videoUploadRef.current = beginPresignedUpload(file, "post_video", setVideoProgress);
              void videoUploadRef.current
                .then((h) => h.done)
                .catch(() => {
                  setVideoProgress(null);
                  toast.error(t("components.createPostForm.publishFailed"));
                });
            }}
            onClear={() => {
              setVideoFile(null);
              setVideoUrl(null);
              setVideoProgress(null);
              videoUploadRef.current = null;
            }}
            progress={videoProgress}
          />
        )}
      </div>

      {sel.source === "profile" && (
        <div
          className="shrink-0 border-t px-[16px] pt-[12px]"
          style={{ borderColor: "var(--border)" }}
        >
          <PostSchedulePicker
            mode={publishMode}
            onModeChange={setPublishMode}
            date={scheduleDate}
            time={scheduleTime}
            timezone={scheduleTimezone}
            onDateChange={setScheduleDate}
            onTimeChange={setScheduleTime}
            onTimezoneChange={setScheduleTimezone}
            disabled={publishing}
          />
        </div>
      )}

      <div
        className="shrink-0 border-t px-[16px] pt-[10px]"
        style={{
          borderColor: "var(--border)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={publish}
          disabled={publishing}
          className="h-[48px] w-full rounded-[var(--r-button)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {publishing
            ? t("components.createPostForm.publishing")
            : publishMode === "schedule"
              ? t("components.createPostForm.scheduleSubmit")
              : t("components.createPostForm.publish")}
        </button>
      </div>

      <PhotoEditorDialog
        open={editingPhotoIndex != null}
        src={
          editingPhotoIndex != null
            ? (photoFiles[editingPhotoIndex] ?? photos[editingPhotoIndex] ?? null)
            : null
        }
        title="Редактирование фото"
        onCancel={() => setEditingPhotoIndex(null)}
        onSave={(blob) => {
          if (editingPhotoIndex != null) replacePhoto(editingPhotoIndex, blob);
          setEditingPhotoIndex(null);
        }}
        onDelete={() => {
          if (editingPhotoIndex != null) removePhoto(editingPhotoIndex);
          setEditingPhotoIndex(null);
        }}
      />
    </div>
  );
}
