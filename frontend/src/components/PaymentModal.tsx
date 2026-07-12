import { CreditCard } from "lucide-react";
import { toast } from "@/lib/toast";

export function PaymentModal({
  open,
  onOpenChange,
  title,
  amount,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  amount: number;
  onSuccess?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">К оплате: {amount} ₽</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          В production будет подключена оплата через <b>ЮKassa</b> или <b>Т-Банк</b>. Сейчас это заглушка для прототипа.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => onOpenChange(false)} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
            Отмена
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              toast.success("Оплата принята (тестовый режим)");
              onSuccess?.();
            }}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Оплатить {amount} ₽
          </button>
        </div>
      </div>
    </div>
  );
}
