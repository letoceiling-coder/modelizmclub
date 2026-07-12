import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { mockWalletBalance, mockWalletOperations } from "@/lib/mock";
import { fetchWalletBalance, fetchWalletTransactions } from "@/lib/api/wallet";
import { isDemoMode } from "@/lib/demo-mode";

export const Route = createFileRoute("/settings/wallet")({
  component: WalletSection,
});

function WalletSection() {
  const [balance, setBalance] = useState(mockWalletBalance);
  const [operations, setOperations] = useState(mockWalletOperations);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchWalletBalance(), fetchWalletTransactions()])
      .then(([b, ops]) => {
        if (!alive) return;
        setBalance(b.balance);
        setOperations(ops.map((op) => ({
          id: op.id,
          type: op.type,
          amount: op.amount,
          title: op.title,
          date: op.date,
        })));
      })
      .catch(() => {
        if (!alive || !isDemoMode()) return;
        setBalance(mockWalletBalance);
        setOperations(mockWalletOperations);
      });
    return () => { alive = false; };
  }, []);

  return (
    <SettingsSectionShell title="Кошелёк">
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)", background: "var(--background-surface)" }}>
        <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Демо-баланс</div>
        <div className="mt-[4px] font-display text-[32px] font-bold" style={{ color: "var(--foreground)" }}>
          {balance.toLocaleString("ru-RU")} ₽
        </div>
      </Card>

      <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>История операций</h2>
      <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        {operations.map((op) => (
          <div key={op.id} className="flex items-center gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
            <span className="grid h-[36px] w-[36px] place-items-center rounded-full" style={{ background: "var(--background-surface)", color: op.type === "in" ? "var(--success)" : "var(--foreground-50)" }}>
              {op.type === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{op.title}</div>
              <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                {new Date(op.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            <div className="shrink-0 text-[14px] font-semibold" style={{ color: op.type === "in" ? "var(--success)" : "var(--foreground)" }}>
              {op.type === "in" ? "+" : "−"}{op.amount.toLocaleString("ru-RU")} ₽
            </div>
          </div>
        ))}
      </Card>
    </SettingsSectionShell>
  );
}
