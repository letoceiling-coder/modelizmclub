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
import { NativeSelect } from "@/components/ui/native-select";
import { registerAskHost, type PendingRequest } from "@/lib/ui/ask";

/** Единственный хост окон подтверждения и ввода. Смонтирован в __root. */
export function AskHost() {
  const [queue, setQueue] = useState<PendingRequest[]>([]);
  const [draft, setDraft] = useState("");
  const current = queue[0] ?? null;

  useEffect(() => registerAskHost((req) => setQueue((q) => [...q, req])), []);

  useEffect(() => {
    if (current === null || current.kind === "confirm") {
      setDraft("");

      return;
    }
    // У выбора значение по умолчанию — первый пункт, а не пустая строка:
    // селект и так покажет его, и «Сохранить» без касания списка должно
    // вернуть то же, что человек видит.
    setDraft(
      current.defaultValue ?? (current.kind === "choice" ? (current.options[0]?.value ?? "") : ""),
    );
  }, [current]);

  const close = (value: string | boolean | null) => {
    current?.resolve(value);
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  const isPrompt = current.kind === "prompt";
  // Ввод и выбор возвращают значение или null; подтверждение — да или нет.
  const хочетЗначение = current.kind !== "confirm";

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        // Закрытие по Esc или клику мимо — это отказ, а не подтверждение.
        if (!open) close(хочетЗначение ? null : false);
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

        {current.kind === "choice" ? (
          <NativeSelect
            value={draft}
            onChange={setDraft}
            options={current.options}
            aria-label={current.title}
          />
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(хочетЗначение ? null : false)}>
            {current.cancelLabel ?? "Отмена"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(хочетЗначение ? draft : true)}
            style={
              current.kind === "confirm" && current.danger
                ? { background: "var(--danger)", color: "var(--danger-foreground, #fff)" }
                : undefined
            }
          >
            {current.confirmLabel ?? (хочетЗначение ? "Сохранить" : "Подтвердить")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
