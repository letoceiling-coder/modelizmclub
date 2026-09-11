import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/messenger/EmojiPicker";
import { useInsertAtCaret } from "@/lib/insert-at-caret";
import type { Post } from "@/lib/mock";
import { userById } from "@/lib/user-registry";

interface Props {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (body: string) => void;
}

export function RepostComposerDialog({ post, open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  // Эмодзи — тот же выбор, что в сообщениях и комментариях, в позицию курсора.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const insertEmoji = useInsertAtCaret(bodyRef, body, setBody);
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
        <div className="flex flex-col gap-[4px]">
          <textarea
            ref={bodyRef}
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
          <div className="flex justify-end">
            <EmojiPicker onPick={insertEmoji} align="end" compact />
          </div>
        </div>
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
