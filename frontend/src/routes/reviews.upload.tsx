import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import type { VideoCategory } from "@/lib/mock";
import { fetchVideoCategories, uploadVideo } from "@/lib/api/reviews";
import { uploadMedia, validateReviewVideoFile } from "@/lib/api/media";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getState, selectors } from "@/lib/store";
import { ensureSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/reviews/upload")({
  head: () => ({ meta: [{ title: i18n.t("pages.reviews.uploadMetaTitle") }] }),
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
  const [access, setAccess] = useState<Access>("checking");
  const [categories, setCategories] = useState<VideoCategory[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [editingPoster, setEditingPoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    ensureSession().then((ok) => {
      if (!alive) return;
      if (!ok) { navigate({ to: "/login" }); return; }
      const me = selectors.currentUser(getState());
      setAccess(me.isAdmin ? "granted" : "forbidden");
    });
    fetchVideoCategories().then((c) => { if (alive) { setCategories(c); setCategoryId(c[0]?.id ?? ""); } }).catch(() => {});
    return () => { alive = false; };
  }, [navigate]);

  const pickVideo = (f: File) => {
    const err = validateReviewVideoFile(f);
    if (err) { toast.error(err); return; }
    setVideoFile(f); setVideoUrl(URL.createObjectURL(f));
  };
  const pickPoster = (f: File) => { setPosterFile(f); setPosterUrl(URL.createObjectURL(f)); };
  const replacePoster = (blob: Blob) => {
    const newFile = new File([blob], posterFile?.name ?? "poster.jpg", { type: blob.type || "image/jpeg" });
    if (posterUrl?.startsWith("blob:")) URL.revokeObjectURL(posterUrl);
    setPosterFile(newFile);
    setPosterUrl(URL.createObjectURL(newFile));
  };

  const valid = title.trim().length >= 3 && categoryId && videoFile;

  const submit = async () => {
    if (!valid || submitting || !videoFile) return;
    const err = validateReviewVideoFile(videoFile);
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const videoMedia = await uploadMedia(videoFile, "review_video");
      const posterMedia = posterFile ? await uploadMedia(posterFile, "post") : null;
      await uploadVideo({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        posterMediaId: posterMedia?.uuid,
        videoMediaId: videoMedia.uuid,
        posterUrl: posterUrl ?? "",
        videoUrl: videoUrl ?? videoMedia.url ?? "",
        isFeatured,
      });
      toast.success(t("pages.reviews.published"));
      void navigate({ to: "/reviews" });
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message || t("pages.reviews.publishFailed")
        : t("pages.reviews.publishFailed");
      toast.error(msg);
      setSubmitting(false);
    }
  };

  if (access === "checking") {
    return <AppLayout rightColumn={false}><div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("pages.reviews.checkingAccess")}</div></AppLayout>;
  }
  if (access === "forbidden") {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[480px] py-[60px] text-center">
          <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)" }}>{t("pages.reviews.accessDenied")}</h1>
          <p className="mt-[8px] text-[14px]" style={{ color: "var(--foreground-70)" }}>{t("pages.reviews.accessDeniedDesc")}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-[16px] py-[8px]">
        <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>{t("pages.reviews.newReview")}</h1>

        <VideoUploadField fileUrl={videoUrl} onPick={pickVideo} onClear={() => { setVideoFile(null); setVideoUrl(null); }} accept="video/*" label={t("pages.reviews.uploadVideo")} />
        <VideoUploadField
          fileUrl={posterUrl}
          onPick={pickPoster}
          onClear={() => { setPosterFile(null); setPosterUrl(null); }}
          onEdit={() => setEditingPoster(true)}
          accept="image/*"
          label={t("pages.reviews.uploadPoster")}
        />
        <PhotoEditorDialog
          open={editingPoster}
          src={posterFile ?? posterUrl}
          title="Редактирование обложки"
          onCancel={() => setEditingPoster(false)}
          onSave={(blob) => { replacePoster(blob); setEditingPoster(false); }}
        />

        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("pages.reviews.titlePlaceholder")} />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("pages.reviews.descriptionPlaceholder")} rows={4} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full text-[14px] outline-none" style={{ background: "var(--background-elevated)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "var(--r-input)", height: 44, padding: "0 12px" }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("pages.reviews.tagsPlaceholder")} />
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
          <span className="text-[13px]" style={{ color: "var(--foreground-70)" }}>{t("pages.reviews.featuredCarousel")}</span>
        </label>

        <Button onClick={submit} disabled={!valid} loading={submitting} size="lg" className="rounded-[var(--r-button)]">
          {submitting ? t("pages.reviews.publishing") : t("pages.reviews.publish")}
        </Button>
      </div>
    </AppLayout>
  );
}
