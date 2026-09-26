import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Handshake, Package, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GuestSectionStub, useGuestRouteBlocked } from "@/components/access/GuestSectionStub";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { kopecksToRub, type SafeDealRole } from "@/lib/api/safe-deals";
import {
  cancelOrdinaryDeal,
  declineOrdinaryDeal,
  fetchDeals,
  type DealItem,
  type DealType,
  type OrdinaryDeal,
} from "@/lib/api/deals";
import { useObjectUpdate } from "@/lib/hooks/useObjectUpdate";
import { DealsPageSkeleton } from "@/components/boot/PageSkeletons";
import { formatAbsoluteInZone } from "@/lib/format/date";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";
import { askConfirm } from "@/lib/ui/ask";
import { toast } from "@/lib/toast";

/*
 * «Сделки»: безопасные и обычные в одном месте.
 *
 * До 17.09 раздел назывался «Безопасные сделки» и показывал только их, а
 * договорённости через переписку не учитывались нигде. Обычная сделка —
 * продажа, отмеченная продавцом в чате; её чат живёт во вкладке «Сделки»
 * мессенджера по тому же правилу (lib/messenger/deal-dialog.ts).
 */
export const Route = createFileRoute("/deals/")({
  validateSearch: (search: Record<string, unknown>): { role?: SafeDealRole; type?: DealType } => ({
    role: search.role === "buyer" || search.role === "seller" ? search.role : undefined,
    type: search.type === "safe" || search.type === "ordinary" ? search.type : undefined,
  }),
  component: DealsRoute,
  pendingComponent: DealsPageSkeleton,
});

const STATUS_COLORS: Record<string, string> = {
  paid: "var(--accent)",
  shipped: "var(--accent)",
  delivered: "var(--success)",
  completed: "var(--success)",
  active: "var(--success)",
  disputed: "var(--danger)",
  refunded: "var(--foreground-50)",
  cancelled: "var(--foreground-50)",
  created: "var(--foreground-50)",
};

const TYPE_OPTIONS: { key: DealType; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "safe", label: "Безопасные" },
  { key: "ordinary", label: "Обычные" },
];

function DealsRoute() {
  const guestBlocked = useGuestRouteBlocked("route.deals");
  const { requireLogin } = useGuestAccess();
  useEffect(() => {
    if (guestBlocked) requireLogin(() => {});
  }, [guestBlocked, requireLogin]);
  if (guestBlocked) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-[720px] px-[16px] py-[48px]">
          <GuestSectionStub
            icon={Handshake}
            title="Войдите, чтобы посмотреть сделки"
            description="Покупки и продажи доступны после входа в аккаунт."
          />
        </div>
      </AppLayout>
    );
  }
  return <DealsPage />;
}

function PillGroup<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-[4px] rounded-[var(--r-pill)] p-[4px]"
      style={{ background: "var(--background-surface)", border: "1px solid var(--border)" }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className="rounded-[var(--r-pill)] px-[14px] py-[8px] text-[14px] font-semibold transition-colors"
          style={{
            background: value === o.key ? "var(--accent-fill)" : "transparent",
            color: value === o.key ? "var(--accent-foreground)" : "var(--foreground-70)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DealsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/deals/" });
  const role: SafeDealRole = search.role ?? "buyer";
  const type: DealType = search.type ?? "all";
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    fetchDeals(role, type)
      .then((d) => {
        if (alive) setDeals(d);
      })
      .catch((e) => {
        reportReadFailure(e, "список сделок");
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [role, type, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  /*
   * Список обновляется сам: шаг меняет вторая сторона, и до 22.09 строка
   * здесь держала прежний, пока страницу не перезагрузят. Идентификатор не
   * сверяем намеренно — в списке лежат все сделки человека, и любая из них
   * может сменить шаг.
   */
  useObjectUpdate({ kind: "deal" }, reload);
  const setSearch = (next: { role?: SafeDealRole; type?: DealType }) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        ...next,
        type: (next.type ?? prev.type) === "all" ? undefined : (next.type ?? prev.type),
      }),
      replace: true,
    });

  return (
    <AppLayout>
      <div className="w-full">
        <div className="flex items-center gap-[10px]">
          <Handshake size={24} style={{ color: "var(--accent)" }} />
          <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>
            Сделки
          </h1>
        </div>
        <p className="mt-[6px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
          Покупки и продажи в одном месте: безопасные — с оплатой через площадку, обычные —
          отмеченные продавцом в переписке.
        </p>
        <div
          className="mt-[14px] flex items-start gap-[10px] rounded-[var(--r-card)] border px-[14px] py-[12px]"
          style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}
        >
          <ShieldCheck size={18} className="mt-[2px] shrink-0" style={{ color: "var(--accent)" }} />
          <p className="text-[13px]" style={{ color: "var(--foreground-80)" }}>
            Безопасные сделки проходят по регламенту ООО «МОДЕЛИЗМ».{" "}
            <a href="/rules/safe-deal" className="font-semibold" style={{ color: "var(--accent)" }}>
              Правила безопасной сделки
            </a>
          </p>
        </div>

        <div className="mt-[20px] flex flex-wrap items-center gap-[8px]">
          <PillGroup
            label="Покупки или продажи"
            value={role}
            options={[
              { key: "buyer", label: "Мои покупки" },
              { key: "seller", label: "Мои продажи" },
            ]}
            onChange={(r) => setSearch({ role: r })}
          />
          <PillGroup
            label="Вид сделки"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(t) => setSearch({ type: t })}
          />
        </div>

        <div className="mt-[16px] flex flex-col gap-[12px]">
          {loading ? (
            <div
              className="flex items-center gap-[8px] py-[24px] text-[14px]"
              style={{ color: "var(--foreground-50)" }}
            >
              <Loader2 size={16} className="animate-spin" /> Загрузка…
            </div>
          ) : failed ? (
            <EmptyState
              icon={AlertCircle}
              title="Сделки не загрузились"
              description="Проверьте соединение и попробуйте ещё раз."
              variant="compact"
              action={{ label: "Повторить", onClick: reload }}
            />
          ) : deals.length === 0 ? (
            <Card
              className="p-[24px] text-center"
              style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
            >
              <Package size={28} className="mx-auto" style={{ color: "var(--foreground-50)" }} />
              <p className="mt-[10px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
                Пока нет сделок
              </p>
            </Card>
          ) : (
            deals.map((item) =>
              item.kind === "safe" ? (
                <Link
                  key={`safe-${item.deal.uuid}`}
                  to="/deals/$uuid"
                  params={{ uuid: item.deal.uuid }}
                  search={{ role }}
                >
                  <DealCard
                    icon={<ShieldCheck size={20} />}
                    kindLabel="Безопасная"
                    title={item.deal.listing_title || `${kopecksToRub(item.deal.amount_kopecks)} ₽`}
                    meta={`${kopecksToRub(item.deal.amount_kopecks)} ₽ · ${formatAbsoluteInZone(item.deal.created_at ?? item.deal.paid_at) || "—"}`}
                    status={item.deal.status}
                    statusLabel={item.deal.status_label}
                  />
                </Link>
              ) : (
                <OrdinaryDealCard
                  key={`ordinary-${item.deal.uuid}`}
                  deal={item.deal}
                  onChanged={reload}
                />
              ),
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function DealCard({
  icon,
  kindLabel,
  title,
  meta,
  status,
  statusLabel,
  footer,
}: {
  icon: React.ReactNode;
  kindLabel: string;
  title: string;
  meta: string;
  status: string;
  statusLabel: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card
      className="p-[16px] transition-colors hover:border-[var(--accent)]"
      style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
    >
      <div className="flex items-center gap-[14px]">
        <span
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
          style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[15px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </div>
          <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {kindLabel} · {meta}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-[10px] py-[4px] text-[12px] font-semibold"
          style={{
            background: "var(--background-surface)",
            color: STATUS_COLORS[status] ?? "var(--foreground-70)",
          }}
        >
          {statusLabel}
        </span>
      </div>
      {footer}
    </Card>
  );
}

function OrdinaryDealCard({ deal, onChanged }: { deal: OrdinaryDeal; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const counterpart = deal.counterpart?.name;
  const meta = [
    `${kopecksToRub(deal.amount_kopecks)} ₽`,
    counterpart
      ? deal.role === "buyer"
        ? `продавец ${counterpart}`
        : `покупатель ${counterpart}`
      : null,
    formatAbsoluteInZone(deal.created_at) || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const close = async () => {
    const asBuyer = deal.role === "buyer";
    const ok = await askConfirm({
      title: asBuyer ? "Отклонить отметку о покупке?" : "Снять отметку о продаже?",
      description: "Сделка исчезнет из раздела «Сделки», объявление вернётся в продажу.",
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (asBuyer) await declineOrdinaryDeal(deal.uuid);
      else await cancelOrdinaryDeal(deal.uuid);
      toast.success("Отметка снята");
      onChanged();
    } catch (e) {
      reportActionFailure(e, "Не удалось снять отметку");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DealCard
      icon={<Handshake size={20} />}
      kindLabel="Обычная"
      title={deal.listing_title || `${kopecksToRub(deal.amount_kopecks)} ₽`}
      meta={meta}
      status={deal.status}
      statusLabel={deal.status_label}
      footer={
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          {deal.conversation_uuid && (
            <Button asChild variant="outline" size="sm">
              <Link to="/messenger" search={{ chat: deal.conversation_uuid }}>
                <MessageSquare size={14} /> Переписка
              </Link>
            </Button>
          )}
          {(deal.can.decline || deal.can.cancel) && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void close()}>
              {deal.can.decline ? "Я не покупал" : "Снять отметку"}
            </Button>
          )}
        </div>
      }
    />
  );
}
