import { useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { usePwaInstall } from "@/lib/hooks/usePwaInstall";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  className?: string;
  /** Закрыть меню, из которого открыли строку. */
  onNavigate?: () => void;
}

/**
 * «Установить приложение» — строка бокового и мобильного меню.
 *
 * Ничего не рисует, когда установка невозможна: приложение уже установлено,
 * браузер не поддерживает установку или условия ещё не выполнены (Chrome даёт
 * beforeinstallprompt не сразу). На iOS вместо системного окна показываем
 * короткую инструкцию — Safari своего события не присылает.
 */
export function InstallAppNavRow({ className, onNavigate }: Props) {
  const { mode, promptInstall } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (mode === "unavailable") return null;

  const label = "Установить приложение";
  const rowClass =
    className ??
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted";

  const handleClick = () => {
    if (mode === "prompt") {
      onNavigate?.();
      void promptInstall();
      return;
    }
    setIosOpen(true);
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={rowClass}>
        <Download className="h-5 w-5 shrink-0" style={{ color: "var(--foreground-70)" }} />
        <span className="min-w-0 flex-1 text-left">{label}</span>
      </button>

      <Dialog
        open={iosOpen}
        onOpenChange={(open) => {
          setIosOpen(open);
          if (!open) onNavigate?.();
        }}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              В Safari на iPhone и iPad приложение добавляется вручную — двумя шагами.
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Share className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--accent)" }} />
              <span>
                Нажмите <strong>«Поделиться»</strong> на нижней панели Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <SquarePlus className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--accent)" }} />
              <span>
                Выберите <strong>«На экран “Домой”»</strong> и подтвердите.
              </span>
            </li>
          </ol>
          <p className="mt-4 text-sm" style={{ color: "var(--foreground-50)" }}>
            После этого МоДелизМ откроется отдельным приложением, без адресной строки.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
