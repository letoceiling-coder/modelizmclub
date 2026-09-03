import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Post } from "@/lib/mock";
import { updatePost } from "@/lib/api/feed";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (post: Post) => void;
}

/** Inline title + text editor — moved out of the community page so every card has it. */
export function EditPostDialog({ post, open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.text);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(post.title);
      setBody(post.text);
    }
  }, [open, post.title, post.text]);

  const save = async () => {
    setBusy(true);
    try {
      const next = await updatePost(post.id, { title: title.trim(), body: body.trim() });
      onSaved({ ...post, ...next, title: title.trim(), text: body.trim() });
      toast.success(t("pages.communityDetail.editPostSaved"));
    } catch {
      toast.error(t("pages.communityDetail.editPostFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>{t("pages.communityDetail.editPostTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-[10px]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button size="lg" onClick={() => void save()} disabled={busy || title.trim().length === 0}>
            {t("pages.communityDetail.editPostSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
