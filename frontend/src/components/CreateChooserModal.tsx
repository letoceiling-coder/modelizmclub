import { useNavigate } from "@tanstack/react-router";
import { Newspaper, Megaphone } from "lucide-react";

export function CreateChooserModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-xl">
        <h3 className="font-display text-base font-semibold">Что создать?</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => { onOpenChange(false); navigate({ to: "/feed", search: { composer: "open" } }); }}
            className="flex flex-col items-center gap-2 rounded-xl border p-4 hover:bg-muted"
          >
            <Newspaper className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">Публикация</span>
          </button>
          <button
            onClick={() => { onOpenChange(false); navigate({ to: "/ads/new" }); }}
            className="flex flex-col items-center gap-2 rounded-xl border p-4 hover:bg-muted"
          >
            <Megaphone className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">Объявление</span>
          </button>
        </div>
      </div>
    </div>
  );
}
