import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/mock";
import { userById } from "@/lib/mock";

interface Props {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (body: string) => void;
}

export function RepostComposerDialog({ post, open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const author = post ? userById(post.authorId) : null;

  const handleOpen = (next: boolean) => {
    if (next) setBody("");
    onOpenChange(next);
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("components.repostMenu.repostToFeed")}</DialogTitle>
        </DialogHeader>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t("components.repostMenu.commentPlaceholder")}
          className="w-full resize-none rounded-[var(--r-input)] border px-[12px] py-[10px] text-[14px] leading-relaxed"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <div
          className="rounded-[12px] border px-[12px] py-[10px]"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
        >
          <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {author?.name ?? t("components.repostMenu.postTitle")}
            {post.category ? ` · ${post.category}` : ""}
          </p>
          <p
            className="mt-[4px] line-clamp-2 text-[14px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {post.title || post.text}
          </p>
        </div>
        <DialogFooter className="gap-[8px]">
          <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
            {t("components.repostMenu.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm(body.trim());
              handleOpen(false);
            }}
          >
            {t("components.repostMenu.shareAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
