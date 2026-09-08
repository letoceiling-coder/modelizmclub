import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { registerAskHost, type PendingRequest } from "@/lib/ui/ask";

/** Единственный хост окон подтверждения и ввода. Смонтирован в __root. */
export function AskHost() {
  const [queue, setQueue] = useState<PendingRequest[]>([]);
  const [draft, setDraft] = useState("");
  const current = queue[0] ?? null;

  useEffect(() => registerAskHost((req) => setQueue((q) => [...q, req])), []);

  useEffect(() => {
    setDraft(current !== null && current.kind === "prompt" ? (current.defaultValue ?? "") : "");
  }, [current]);

  const close = (value: string | boolean | null) => {
    current?.resolve(value);
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  const isPrompt = current.kind === "prompt";

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        // Закрытие по Esc или клику мимо — это отказ, а не подтверждение.
        if (!open) close(isPrompt ? null : false);
      }}
    >
      <AlertDialogContent className="max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{current.title}</AlertDialogTitle>
          {current.description ? (
            <AlertDialogDescription>{current.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {isPrompt ? (
          <Input
            autoFocus
            value={draft}
            placeholder={current.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                close(draft);
              }
            }}
          />
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(isPrompt ? null : false)}>
            {current.cancelLabel ?? "Отмена"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(isPrompt ? draft : true)}
            style={
              !isPrompt && current.danger
                ? { background: "var(--danger)", color: "var(--danger-foreground, #fff)" }
                : undefined
            }
          >
            {current.confirmLabel ?? (isPrompt ? "Сохранить" : "Подтвердить")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
