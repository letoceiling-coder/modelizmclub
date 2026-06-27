import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityName: string;
}

export function SubmitPostSheet({ open, onOpenChange, communityName }: Props) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (!title.trim() || !text.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onOpenChange(false);
      setTitle("");
      setText("");
      toast.success("Пост отправлен на рассмотрение", {
        description: `Администратор сообщества «${communityName}» рассмотрит его в ближайшее время`,
      });
    }, 600);
  };

  const input: React.CSSProperties = {
    width: "100%", background: "var(--background-surface)", border: "1.5px solid transparent",
    borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "var(--foreground)", outline: "none",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-lg sm:left-1/2 sm:-translate-x-1/2">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Предложить пост</SheetTitle>
          <SheetDescription>
            Пост не публикуется автоматически. Администратор сообщества рассмотрит и решит, публиковать ли его.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--foreground-70)" }}>Заголовок</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Кратко о чём пост" style={input} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--foreground-70)" }}>Текст</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Расскажите подробнее..." rows={6} style={{ ...input, resize: "vertical", minHeight: 120 }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="font-medium" style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--foreground-70)", fontSize: 14 }}>
              Отмена
            </button>
            <button onClick={submit} disabled={!title.trim() || !text.trim() || submitting} className="font-semibold disabled:opacity-50" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14 }}>
              {submitting ? "Отправка..." : "Отправить на рассмотрение"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
