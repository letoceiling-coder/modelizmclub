import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { fetchPostCategories } from "@/lib/api/catalog";
import { createPost } from "@/lib/api/feed";
import { hasAuthForApi } from "@/lib/api/auth-api";
import type { Post } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityName: string;
  communityDbId?: number;
  onCreated?: (post: Post) => void;
}

export function SubmitPostSheet({ open, onOpenChange, communityName, communityDbId, onCreated }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetchPostCategories().then((items) => {
      const first = items[0];
      setCategoryId(first ? Number(first.id) : null);
    }).catch(() => setCategoryId(null));
  }, [open]);

  const submit = async () => {
    if (!title.trim() || !text.trim()) return;
    if (!hasAuthForApi()) return toast.error(t("auth.loginRequired"));
    if (!communityDbId) return toast.error(t("common.error"));
    if (!categoryId) return toast.error(t("ads.categoryRequired"));

    setSubmitting(true);
    try {
      const post = await createPost({
        title: title.trim(),
        body: text.trim(),
        category_id: categoryId,
        community_id: communityDbId,
        publish: true,
      });
      onOpenChange(false);
      setTitle("");
      setText("");
      onCreated?.(post);
      toast.success(t("communities.submitPostSuccess"), {
        description: t("communities.submitPostSuccessDesc", { name: communityName }),
      });
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%", background: "var(--background-surface)", border: "1.5px solid transparent",
    borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "var(--foreground)", outline: "none",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-lg sm:left-1/2 sm:-translate-x-1/2">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>{t("communities.suggestPost")}</SheetTitle>
          <SheetDescription>{t("communities.submitPostDesc")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--foreground-70)" }}>{t("communities.submitPostTitleLabel")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("communities.submitPostTitlePlaceholder")} style={input} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--foreground-70)" }}>{t("communities.submitPostTextLabel")}</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("communities.submitPostTextPlaceholder")} rows={6} style={{ ...input, resize: "vertical", minHeight: 120 }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="font-medium" style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--foreground-70)", fontSize: 14 }}>{t("common.cancel")}</button>
            <button onClick={() => void submit()} disabled={!title.trim() || !text.trim() || submitting || !communityDbId} className="font-semibold disabled:opacity-50" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14 }}>
              {submitting ? t("communities.submitPostSending") : t("communities.submitPostSend")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
