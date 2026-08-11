import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Loader2, Package } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  confirmEscrowReceipt,
  escrowStatusLabel,
  fetchMyEscrowDeals,
  markEscrowShipped,
  openEscrowDispute,
  syncEscrowDeal,
  type EscrowDeal,
} from "@/lib/api/escrow";
import { confirmShipment } from "@/lib/api/shipments";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/settings/escrow-deals")({
  component: EscrowDealsSection,
});

function rub(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("ru-RU")} ₽`;
}

function EscrowDealsSection() {
  const { t } = useTranslation();
  const [role, setRole] = useState<"all" | "buyer" | "seller">("all");
  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchMyEscrowDeals({ role: role === "all" ? undefined : role, perPage: 50 })
      .then((res) => setDeals(res.data))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [role]);

  const run = async (uuid: string, fn: () => Promise<EscrowDeal>) => {
    setBusyId(uuid);
    try {
      const updated = await fn();
      setDeals((rows) => rows.map((d) => (d.uuid === uuid ? updated : d)));
      toast.success(t("pages.settings.escrowDeals.updated"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.escrowDeals.error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsSectionShell title={t("pages.settings.escrowDeals.title")}>
      <p className="text-[13px] mb-[12px]" style={{ color: "var(--foreground-70)" }}>
        {t("pages.settings.escrowDeals.hint")}{" "}
        <Link to="/info/$slug" params={{ slug: "escrow-rules" }} className="underline" style={{ color: "var(--accent)" }}>
          {t("pages.settings.escrowDeals.rulesLink")}
        </Link>
      </p>

      <div className="flex gap-2 mb-[16px]">
        {(["all", "buyer", "seller"] as const).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={role === r ? "default" : "outline"}
            onClick={() => setRole(r)}
            className="rounded-[8px]"
          >
            {t(`pages.settings.escrowDeals.role.${r}`)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-[40px]">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("pages.settings.escrowDeals.empty")}
          description={t("pages.settings.escrowDeals.emptyDesc")}
          variant="compact"
        />
      ) : (
        <div className="flex flex-col gap-[10px]">
          {deals.map((deal) => (
            <div
              key={deal.uuid}
              className="rounded-[12px] border p-[14px]"
              style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-[8px]">
                <div className="min-w-0">
                  {deal.listing_slug ? (
                    <Link
                      to="/ads/$id"
                      params={{ id: deal.listing_slug }}
                      className="text-[15px] font-medium hover:underline"
                      style={{ color: "var(--foreground)" }}
                    >
                      {deal.listing_title ?? deal.listing_uuid}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-medium">{deal.listing_title ?? deal.uuid}</span>
                  )}
                  <div className="text-[12px] mt-[4px]" style={{ color: "var(--foreground-50)" }}>
                    {escrowStatusLabel(deal.status)}
                    {deal.role ? ` · ${t(`pages.settings.escrowDeals.role.${deal.role}`)}` : ""}
                    {deal.dispute_status === "open" ? ` · ${t("pages.settings.escrowDeals.dispute")}` : ""}
                  </div>
                  <div className="text-[13px] mt-[6px]" style={{ color: "var(--foreground-70)" }}>
                    {rub(deal.amount_cents)}
                    {deal.platform_fee_cents > 0 ? ` · ${t("pages.settings.escrowDeals.fee")} ${rub(deal.platform_fee_cents)}` : ""}
                  </div>
                  {deal.shipment?.tracking_number && (
                    <div className="text-[12px] mt-[4px] flex items-center gap-1" style={{ color: "var(--foreground-50)" }}>
                      <Package size={12} />
                      {deal.shipment.tracking_number}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {deal.status === "pending_payment" && (
                    <Button size="sm" variant="outline" disabled={busyId === deal.uuid} onClick={() => void run(deal.uuid, () => syncEscrowDeal(deal.uuid))}>
                      {t("pages.settings.escrowDeals.syncPayment")}
                    </Button>
                  )}
                  {deal.can_mark_shipped && (
                    <Button size="sm" variant="outline" disabled={busyId === deal.uuid} onClick={() => void run(deal.uuid, () => markEscrowShipped(deal.uuid))}>
                      {t("pages.settings.escrowDeals.markShipped")}
                    </Button>
                  )}
                  {deal.can_confirm_shipment && deal.shipment && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === deal.uuid}
                      onClick={async () => {
                        setBusyId(deal.uuid);
                        try {
                          await confirmShipment(deal.shipment!.uuid);
                          const updated = await syncEscrowDeal(deal.uuid);
                          setDeals((rows) => rows.map((d) => (d.uuid === deal.uuid ? updated : d)));
                          toast.success(t("pages.settings.escrowDeals.shipConfirmed"));
                        } catch (err) {
                          toast.error(err instanceof ApiError ? err.message : t("pages.settings.escrowDeals.error"));
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      {t("pages.settings.escrowDeals.confirmCarrier")}
                    </Button>
                  )}
                  {deal.can_confirm_receipt && (
                    <Button size="sm" disabled={busyId === deal.uuid} onClick={() => void run(deal.uuid, () => confirmEscrowReceipt(deal.uuid))}>
                      {t("pages.settings.escrowDeals.confirmReceipt")}
                    </Button>
                  )}
                  {deal.can_open_dispute && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === deal.uuid}
                      onClick={() => {
                        const reason = window.prompt(t("pages.settings.escrowDeals.disputePrompt"));
                        if (reason && reason.trim().length >= 10) {
                          void run(deal.uuid, () => openEscrowDispute(deal.uuid, reason.trim()));
                        }
                      }}
                    >
                      {t("pages.settings.escrowDeals.openDispute")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsSectionShell>
  );
}
