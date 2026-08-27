import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Package, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth/session";
import { fetchSafeDeals, kopecksToRub, type SafeDeal, type SafeDealRole } from "@/lib/api/safe-deals";

export const Route = createFileRoute("/deals")({
  component: DealsPage,
});

const STATUS_COLORS: Record<string, string> = {
  paid: "var(--accent)",
  shipped: "var(--accent)",
  delivered: "var(--success)",
  completed: "var(--success)",
  disputed: "var(--danger)",
  refunded: "var(--foreground-50)",
  cancelled: "var(--foreground-50)",
  created: "var(--foreground-50)",
};

function DealsPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<SafeDealRole>("buyer");
  const [deals, setDeals] = useState<SafeDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login", search: { redirect: "/deals" } });
      return;
    }
    let alive = true;
    setLoading(true);
    fetchSafeDeals(role)
      .then((d) => { if (alive) setDeals(d); })
      .catch(() => { if (alive) setDeals([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [role, navigate]);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex items-center gap-[10px]">
          <ShieldCheck size={24} style={{ color: "var(--accent)" }} />
          <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>Безопасные сделки</h1>
        </div>
        <p className="mt-[6px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
          Оплата замораживается на балансе и переводится продавцу только после подтверждения получения.
        </p>
        <div
          className="mt-[14px] flex items-start gap-[10px] rounded-[var(--r-card)] border px-[14px] py-[12px]"
          style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}
        >
          <ShieldCheck size={18} className="mt-[2px] shrink-0" style={{ color: "var(--accent)" }} />
          <p className="text-[13px]" style={{ color: "var(--foreground-80)" }}>
            Сделки проходят по регламенту ООО «МОДЕЛИЗМ».{" "}
            <a href="/rules/safe-deal" className="font-semibold" style={{ color: "var(--accent)" }}>
              Правила безопасной сделки
            </a>
          </p>
        </div>

        <div className="mt-[20px] inline-flex gap-[4px] rounded-[var(--r-pill)] p-[4px]" style={{ background: "var(--background-surface)", border: "1px solid var(--border)" }}>
          {(["buyer", "seller"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="rounded-[var(--r-pill)] px-[16px] py-[8px] text-[14px] font-semibold transition-colors"
              style={{
                background: role === r ? "var(--accent)" : "transparent",
                color: role === r ? "var(--accent-foreground)" : "var(--foreground-70)",
              }}
            >
              {r === "buyer" ? "Мои покупки" : "Мои продажи"}
            </button>
          ))}
        </div>

        <div className="mt-[16px] flex flex-col gap-[12px]">
          {loading ? (
            <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
              <Loader2 size={16} className="animate-spin" /> Загрузка…
            </div>
          ) : deals.length === 0 ? (
            <Card className="p-[24px] text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed", borderRadius: "var(--r-card)" }}>
              <Package size={28} className="mx-auto" style={{ color: "var(--foreground-50)" }} />
              <p className="mt-[10px] text-[14px]" style={{ color: "var(--foreground-50)" }}>Пока нет сделок</p>
            </Card>
          ) : (
            deals.map((deal) => (
              <Link key={deal.uuid} to="/deals/$uuid" params={{ uuid: deal.uuid }} search={{ role }}>
                <Card className="flex items-center gap-[14px] p-[16px] transition-colors hover:border-[var(--accent)]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
                  <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full" style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}>
                    <ShieldCheck size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                      {deal.listing_title || `${kopecksToRub(deal.amount_kopecks)} ₽`}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      {kopecksToRub(deal.amount_kopecks)} ₽ · {deal.paid_at ? new Date(deal.paid_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-[10px] py-[4px] text-[12px] font-semibold" style={{ background: "var(--background-surface)", color: STATUS_COLORS[deal.status] ?? "var(--foreground-70)" }}>
                    {deal.status_label}
                  </span>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
