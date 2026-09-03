import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPayment, resolveStubPayment, type StubPayOutcome } from "@/lib/api/payment";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { isAuthenticated } from "@/lib/auth/session";

export const Route = createFileRoute("/pay/stub/$uuid")({
  head: () => ({ meta: [{ title: "Оплата — тестовый контур" }] }),
  component: StubAcquiringPage,
});

function formatRub(cents: number): string {
  return (cents / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function payableLabel(type: unknown, t: (k: string) => string): string {
  switch (type) {
    case "wallet_topup":
      return t("pages.stubPay.kindWallet");
    case "listing_placement":
      return t("pages.stubPay.kindListing");
    case "listing_boost":
      return t("pages.stubPay.kindBoost");
    case "subscription":
      return t("pages.stubPay.kindSubscription");
    default:
      return t("pages.stubPay.kindGeneric");
  }
}

function fallbackReturn(kind: string, uuid: string, success: boolean): string {
  const status = success ? "success" : "failed";
  const q = `payment=${status}&uuid=${encodeURIComponent(uuid)}`;
  if (kind === "wallet_topup") return `/settings/wallet?${q}`;
  if (kind === "listing_placement" || kind === "listing_boost") return `/my-ads?${q}`;
  return `/subscription?${q}`;
}

function StubAcquiringPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uuid } = Route.useParams();
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<string>("subscription");
  const [busy, setBusy] = useState<StubPayOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/login", search: { redirect: `/pay/stub/${uuid}` } });
      return;
    }
    let alive = true;
    fetchPayment(uuid)
      .then((p) => {
        if (!alive) return;
        const meta = p.metadata ?? {};
        const payable = typeof meta.payable_type === "string" ? meta.payable_type : "subscription";
        setAmountCents(p.amount_cents);
        setDescription(typeof meta.description === "string" ? meta.description : "");
        setKind(payable);
        if (p.status === "paid" || p.status === "failed") {
          const stored = p.status === "paid" ? meta.return_url : meta.fail_url;
          if (typeof stored === "string" && (stored.startsWith("http") || stored.startsWith("/"))) {
            window.location.replace(stored);
            return;
          }
          window.location.replace(fallbackReturn(payable, uuid, p.status === "paid"));
        }
      })
      .catch((err) => {
        if (alive) setError(formatApiErrorMessage(err, t("pages.stubPay.loadFailed")));
      });
    return () => {
      alive = false;
    };
  }, [navigate, t, uuid]);

  const run = async (outcome: StubPayOutcome) => {
    setBusy(outcome);
    setError(null);
    try {
      const res = await resolveStubPayment(uuid, outcome);
      window.location.replace(res.redirect_url);
    } catch (err) {
      setBusy(null);
      setError(formatApiErrorMessage(err, t("pages.stubPay.actionFailed")));
    }
  };

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4 py-10"
      style={{ background: "#0f2a4a" }}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden"
        style={{
          background: "var(--background)",
          borderRadius: 16,
          border: "1px solid var(--border)",
        }}
      >
        <div className="px-[20px] py-[16px]" style={{ background: "#1a4f8b", color: "#fff" }}>
          <div className="text-[11px] uppercase tracking-[0.14em] opacity-80">
            {t("pages.stubPay.bank")}
          </div>
          <div className="mt-[4px] text-[18px] font-semibold">{t("pages.stubPay.title")}</div>
          <div className="mt-[6px] text-[12px] opacity-85">{t("pages.stubPay.banner")}</div>
        </div>

        <div className="space-y-[14px] px-[20px] py-[20px]">
          {error && (
            <p className="text-[13px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div>
            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.stubPay.merchant")}
            </div>
            <div className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
              ООО «МОДЕЛИЗМ»
            </div>
          </div>
          <div>
            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.stubPay.purpose")}
            </div>
            <div className="text-[14px]" style={{ color: "var(--foreground)" }}>
              {description || payableLabel(kind, t)}
            </div>
          </div>
          <div>
            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.stubPay.amount")}
            </div>
            <div
              className="font-display text-[28px] font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {amountCents == null ? "…" : `${formatRub(amountCents)} ₽`}
            </div>
          </div>

          <div className="flex flex-col gap-[8px] pt-[6px]">
            <Button
              disabled={busy !== null || amountCents == null}
              onClick={() => void run("paid")}
            >
              {busy === "paid" && <Loader2 size={16} className="mr-[8px] animate-spin" />}
              {t("pages.stubPay.pay")}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null || amountCents == null}
              onClick={() => void run("insufficient_funds")}
            >
              {busy === "insufficient_funds" && (
                <Loader2 size={16} className="mr-[8px] animate-spin" />
              )}
              {t("pages.stubPay.noFunds")}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null || amountCents == null}
              onClick={() => void run("declined")}
            >
              {busy === "declined" && <Loader2 size={16} className="mr-[8px] animate-spin" />}
              {t("pages.stubPay.badCard")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
