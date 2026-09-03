import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import type { VideoCategory } from "@/lib/mock";
import {
  fetchVideoCategories,
  fetchVideoTags,
  scheduleVideo,
  uploadVideo,
} from "@/lib/api/reviews";
import { TagInput } from "@/components/reviews/TagInput";
import { fetchAdminVideo, updateAdminVideo } from "@/lib/api/admin";
import { PostSchedulePicker, useInitialScheduleState } from "@/components/feed/PostSchedulePicker";
import {
  buildSchedulePayload,
  isScheduleDateTimeValid,
  type PublishMode,
} from "@/lib/post-schedule";
import { uploadMedia, uploadMediaDeduped, validateReviewVideoFile } from "@/lib/api/media";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";
import { ensureSession } from "@/lib/auth/session";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/reviews/upload")({
  head: () => ({ meta: [{ title: i18n.t("pages.reviews.uploadMetaTitle") }] }),
  validateSearch: (search: Record<string, unknown>): { edit?: string } => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
  component: UploadPage,
});
type Access = "checking" | "granted" | "forbidden";

function UploadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { edit: editUuid } = Route.useSearch();
  const isEditMode = Boolean(editUuid);
  const [access, setAccess] = useState<Access>("checking");
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editUuid));
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [editingPoster, setEditingPoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scheduleDefaults = useInitialScheduleState();
  const [publishMode, setPublishMode] = useState<PublishMode>(scheduleDefaults.mode);
  const [scheduleDate, setScheduleDate] = useState(scheduleDefaults.date);
  const [scheduleTime, setScheduleTime] = useState(scheduleDefaults.time);
  const [scheduleTimezone, setScheduleTimezone] = useState(scheduleDefaults.timezone);

  useEffect(() => {
    let alive = true;
    ensureSession().then((ok) => {
      if (!alive) return;
      if (!ok) {
        navigate({ to: "/login" });
        return;
      }
      const me = getSessionUser();
      setAccess(me.isAdmin ? "granted" : "forbidden");
    });
    fetchVideoCategories()
      .then((c) => {
        if (!alive) return;
        setCategories(c);
        if (!editUuid) setCategoryId(c[0]?.id ?? "");
      })
      .catch(() => {});
    fetchVideoTags()
      .then((list) => setTagSuggestions(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [navigate, editUuid]);

  useEffect(() => {
    if (!editUuid || access !== "granted") return;
    let alive = true;
    setLoadingEdit(true);
    fetchAdminVideo(editUuid)
      .then((video) => {
        if (!alive) return;
        setTitle(video.title);
        setDescription(video.description);
        setCategoryId(video.categoryId ?? categories[0]?.id ?? "");
        setTags(video.tags);
        setIsFeatured(video.isFeatured);
        setVideoUrl(video.videoUrl ?? null);
        setPosterUrl(video.posterUrl ?? null);
      })
      .catch(() => {
        if (alive) toast.error(t("pages.reviews.loadEditFailed"));
      })
      .finally(() => {
        if (alive) setLoadingEdit(false);
      });
    return () => {
      alive = false;
    };
  }, [editUuid, access, t, categories]);
  const pickVideo = (f: File) => {
    const err = validateReviewVideoFile(f);
    if (err) {
      toast.error(err);
      return;
    }
    setVideoFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setVideoProgress(0);
    void uploadMediaDeduped(f, "review_video", setVideoProgress).catch(() =>
      setVideoProgress(null),
    );
  };
  const pickPoster = (f: File) => {
    setPosterFile(f);
    setPosterUrl(URL.createObjectURL(f));
  };
  const replacePoster = (blob: Blob) => {
    const newFile = new File([blob], posterFile?.name ?? "poster.jpg", {
      type: blob.type || "image/jpeg",
    });
    if (posterUrl?.startsWith("blob:")) URL.revokeObjectURL(posterUrl);
    setPosterFile(newFile);
    setPosterUrl(URL.createObjectURL(newFile));
  };

  const valid = title.trim().length >= 3 && categoryId && (videoFile || (isEditMode && videoUrl));

  const submit = async () => {
    if (!valid || submitting) return;
    if (videoFile) {
      const err = validateReviewVideoFile(videoFile);
      if (err) {
        toast.error(err);
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isEditMode && editUuid) {
        const videoMedia = videoFile
          ? await uploadMediaDeduped(videoFile, "review_video", setVideoProgress)
          : null;
        const posterMedia = posterFile ? await uploadMedia(posterFile, "post") : null;
        await updateAdminVideo(editUuid, {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          tags,
          isFeatured,
          ...(posterMedia ? { posterMediaId: posterMedia.uuid } : {}),
          ...(videoMedia ? { videoMediaId: videoMedia.uuid } : {}),
        });
        toast.success(t("pages.reviews.saved"));
        void navigate({ to: "/admin", search: { section: "reviews" } });
        return;
      }

      if (!videoFile) return;
      const videoMedia = await uploadMediaDeduped(videoFile, "review_video", setVideoProgress);
      const posterMedia = posterFile ? await uploadMedia(posterFile, "post") : null;
      const video = await uploadVideo({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        tags,
        posterMediaId: posterMedia?.uuid,
        videoMediaId: videoMedia.uuid,
        posterUrl: posterUrl ?? "",
        videoUrl: videoUrl ?? videoMedia.url ?? "",
        isFeatured,
      });
      if (publishMode === "schedule") {
        if (!isScheduleDateTimeValid(scheduleDate, scheduleTime)) {
          toast.error(t("components.postSchedule.invalidDateTime"));
          setSubmitting(false);
          return;
        }
        await scheduleVideo(
          video.id,
          buildSchedulePayload(scheduleDate, scheduleTime, scheduleTimezone),
        );
        toast.success(t("components.createPostForm.scheduled"));
      } else {
        toast.success(t("pages.reviews.published"));
      }
      void navigate({ to: "/reviews" });
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.reviews.publishFailed")));
      setSubmitting(false);
    }
  };
  if (access === "checking" || loadingEdit) {
    return (
      <AppLayout rightColumn={false}>
        <div
          className="py-[60px] text-center text-[14px]"
          style={{ color: "var(--foreground-50)" }}
        >
          {t("pages.reviews.checkingAccess")}
        </div>
      </AppLayout>
    );
  }
  if (access === "forbidden") {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[480px] py-[60px] text-center">
          <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)" }}>
            {t("pages.reviews.accessDenied")}
          </h1>
          <p className="mt-[8px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
            {t("pages.reviews.accessDeniedDesc")}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-[16px] py-[8px]">
        <h1
          className="font-display text-[24px] font-bold"
          style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
        >
          {isEditMode ? t("pages.reviews.editReview") : t("pages.reviews.newReview")}
        </h1>
        <VideoUploadField
          fileUrl={videoUrl}
          onPick={pickVideo}
          onClear={() => {
            setVideoFile(null);
            setVideoUrl(null);
            setVideoProgress(null);
          }}
          accept="video/*"
          label={t("pages.reviews.uploadVideo")}
          progress={videoProgress}
        />
        <VideoUploadField
          fileUrl={posterUrl}
          onPick={pickPoster}
          onClear={() => {
            setPosterFile(null);
            setPosterUrl(null);
          }}
          onEdit={() => setEditingPoster(true)}
          accept="image/*"
          label={t("pages.reviews.uploadPoster")}
        />
        <PhotoEditorDialog
          open={editingPoster}
          src={posterFile ?? posterUrl}
          title={t("pages.reviews.editPoster")}
          aspect={16 / 9}
          lockAspect
          safeZonePreset="review-cover"
          onCancel={() => setEditingPoster(false)}
          onSave={(blob) => {
            replacePoster(blob);
            setEditingPoster(false);
          }}
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("pages.reviews.titlePlaceholder")}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("pages.reviews.descriptionPlaceholder")}
          rows={4}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full text-[14px] outline-none"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-input)",
            height: 44,
            padding: "0 12px",
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions} />
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
            {t("pages.reviews.featuredCarousel")}
          </span>
        </label>
        {!isEditMode && (
          <PostSchedulePicker
            mode={publishMode}
            onModeChange={setPublishMode}
            date={scheduleDate}
            time={scheduleTime}
            timezone={scheduleTimezone}
            onDateChange={setScheduleDate}
            onTimeChange={setScheduleTime}
            onTimezoneChange={setScheduleTimezone}
            disabled={submitting}
          />
        )}
        <Button
          onClick={submit}
          disabled={!valid}
          loading={submitting}
          size="lg"
          className="rounded-[var(--r-button)]"
        >
          {submitting
            ? t("pages.reviews.publishing")
            : isEditMode
              ? t("pages.reviews.saveChanges")
              : publishMode === "schedule"
                ? t("components.createPostForm.scheduleSubmit")
                : t("pages.reviews.publish")}
        </Button>{" "}
      </div>
    </AppLayout>
  );
}
