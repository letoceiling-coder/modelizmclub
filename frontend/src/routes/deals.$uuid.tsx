import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, ShieldCheck, Truck, CheckCircle2, XCircle, AlertTriangle, Package, Paperclip, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { GuestSectionStub, useGuestRouteBlocked } from "@/components/access/GuestSectionStub";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { uploadMedia } from "@/lib/api/media";
import {
  fetchSafeDeal,
  resolveSafeDealRole,
  shipSafeDeal,
  markSafeDealDelivered,
  confirmSafeDeal,
  cancelSafeDeal,
  disputeSafeDeal,
  reviewSafeDeal,
  kopecksToRub,
  type SafeDeal,
  type SafeDealRole,
} from "@/lib/api/safe-deals";
import { DealsPageSkeleton } from "@/components/boot/PageSkeletons";
import { formatDate } from "@/lib/format/date";

export const Route = createFileRoute("/deals/$uuid")({
  validateSearch: (search: Record<string, unknown>): { role?: SafeDealRole } => ({
    role: search.role === "buyer" || search.role === "seller" ? search.role : undefined,
  }),
  pendingComponent: DealsPageSkeleton,
  component: DealDetailRoute,
});

function fmt(date: string | null): string {
  return date ? formatDate(date, "absolute") : "—";
}

function reviewDismissedKey(uuid: string): string {
  return `deal-review-dismissed:${uuid}`;
}

function DealDetailRoute() {
  const guestBlocked = useGuestRouteBlocked("route.deals");
  const { requireLogin } = useGuestAccess();
  useEffect(() => {
    if (guestBlocked) requireLogin(() => {});
  }, [guestBlocked, requireLogin]);
  if (guestBlocked) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto w-full max-w-[720px] px-[16px] py-[48px]">
          <GuestSectionStub
            icon={ShieldCheck}
            title="Войдите, чтобы посмотреть сделки"
            description="Безопасные сделки доступны после входа в аккаунт."
          />
        </div>
      </AppLayout>
    );
  }
  return <DealDetailPage />;
}

function DealDetailPage() {
  const { uuid } = Route.useParams();
  const { role: roleHint } = Route.useSearch();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<SafeDeal | null>(null);
  const [role, setRole] = useState<SafeDealRole | null>(roleHint ?? null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const reload = async () => {
    const d = await fetchSafeDeal(uuid);
    setDeal(d);
    return d;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const d = await fetchSafeDeal(uuid);
        if (!alive) return;
        setDeal(d);
        if (!roleHint) {
          const resolved = await resolveSafeDealRole(uuid);
          if (alive) setRole(resolved);
        }
      } catch {
        if (alive) setDeal(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [uuid, roleHint]);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      const next = await reload();
      toast.success(successMsg);
      return next;
    } catch {
      toast.error("Не удалось выполнить действие");
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!deal?.can_review || deal.status !== "completed" || role !== "buyer") return;
    if (typeof window !== "undefined" && sessionStorage.getItem(reviewDismissedKey(uuid))) return;
    setReviewOpen(true);
  }, [deal?.can_review, deal?.status, uuid, role]);

  if (loading) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto w-full max-w-[640px] py-[40px]">
          <div className="flex items-center gap-[8px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
            <Loader2 size={16} className="animate-spin" /> Загрузка…
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!deal) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto w-full max-w-[640px] py-[40px] text-center">
          <p className="text-[15px]" style={{ color: "var(--foreground-70)" }}>Сделка не найдена</p>
          <Button className="mt-[16px]" variant="outline" onClick={() => navigate({ to: "/deals" })}>К сделкам</Button>
        </div>
      </AppLayout>
    );
  }

  const isBuyer = role === "buyer";
  const isSeller = role === "seller";
  const s = deal.status;
  const holdOpen = !deal.hold_expires_at || new Date(deal.hold_expires_at).getTime() > Date.now();
  const canShip = isSeller && s === "paid";
  const canMarkDelivered = isSeller && (s === "paid" || s === "shipped");
  const canConfirm = isBuyer && (s === "paid" || s === "shipped" || s === "delivered");
  const canCancel = (s === "paid" || s === "shipped");
  const canDispute = (s === "paid" || s === "shipped" || s === "delivered") && holdOpen;

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[640px]">
        <Link to="/deals" className="mb-[16px] inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <ChevronLeft size={14} /> К сделкам
        </Link>

        <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)", background: "var(--background-elevated)" }}>
          <div className="flex items-center justify-between gap-[12px]">
            <div className="flex items-center gap-[10px]">
              <ShieldCheck size={22} style={{ color: "var(--accent)" }} />
              <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{isBuyer ? "Вы покупатель" : isSeller ? "Вы продавец" : "Сделка"}</span>
            </div>
            <span className="rounded-full px-[12px] py-[5px] text-[13px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {deal.status_label}
            </span>
          </div>

          <div className="mt-[16px] font-display text-[32px] font-bold" style={{ color: "var(--foreground)" }}>
            {kopecksToRub(deal.amount_kopecks)} ₽
          </div>
          {deal.listing_title && (
            <div className="mt-[6px] text-[15px] font-medium" style={{ color: "var(--foreground)" }}>{deal.listing_title}</div>
          )}

          <div className="mt-[12px] grid gap-[8px] text-[13px]">
            <Row label="Комиссия платформы" value={`${kopecksToRub(deal.platform_fee_kopecks)} ₽`} />
            <Row label="Доставка СДЭК" value={`${kopecksToRub(deal.delivery_cost_kopecks ?? 0)} ₽`} />
            <Row label="Выплата продавцу" value={`${kopecksToRub(deal.seller_payout_kopecks)} ₽`} />
            {deal.tracking_number && <Row label="Трек-номер" value={deal.tracking_number} />}
            {deal.delivery_method && <Row label="Способ доставки" value={deal.delivery_method} />}
            {deal.listing_uuid && (
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--foreground-50)" }}>Объявление</span>
                <Link to="/ads/$id" params={{ id: deal.listing_uuid }} className="font-medium" style={{ color: "var(--accent)" }}>Открыть</Link>
              </div>
            )}
          </div>

          {deal.checkout_url && (
            <div className="mt-[14px] rounded-[var(--r-card-sm)] p-[12px]" style={{ background: "var(--accent-soft)" }}>
              <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Оплата не завершена</div>
              <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                {deal.escrow_holds_on_card === false
                  ? "Сделка ждёт оплаты. Деньги будут храниться на счёте платформы и уйдут продавцу только после того, как вы подтвердите получение."
                  : "Сделка ждёт подтверждения оплаты. Банк удержит сумму на карте — списание произойдёт только после того, как вы подтвердите получение."}
              </p>
              <Button asChild className="mt-[10px]">
                <a href={deal.checkout_url}>Перейти к оплате</a>
              </Button>
            </div>
          )}

          {deal.dispute && (
            <div className="mt-[14px] flex items-start gap-[8px] rounded-[var(--r-card-sm)] p-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              <AlertTriangle size={16} className="mt-[1px] shrink-0" />
              <div className="text-[13px]">
                <div className="font-semibold">Открыт спор</div>
                <div style={{ color: "var(--foreground-70)" }}>Причина: {deal.dispute.reason}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Timeline */}
        <Card className="mt-[16px] p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>Статус заказа</h2>
          <DealTimeline deal={deal} />
        </Card>

        {/* Actions */}
        {(canShip || canMarkDelivered || canConfirm || canCancel || canDispute) && (
          <div className="mt-[16px] flex flex-wrap gap-[10px]">
            {canShip && (
              <Button onClick={() => {
                if (deal.destination_point || deal.delivery_method === "СДЭК") {
                  void runAction(() => shipSafeDeal(uuid), "Заказ передан в СДЭК");
                } else {
                  setShipOpen(true);
                }
              }} disabled={busy} className="gap-[8px]">
                <Truck size={16} /> {deal.destination_point || deal.delivery_method === "СДЭК" ? "Передать в СДЭК" : "Отметить отправку"}
              </Button>
            )}
            {canMarkDelivered && (
              <Button variant="outline" disabled={busy} onClick={() => void runAction(() => markSafeDealDelivered(uuid), "Отмечено доставленным")} className="gap-[8px]">
                <Package size={16} /> Отметить доставку
              </Button>
            )}
            {canConfirm && (
              <Button variant="success" disabled={busy} className="gap-[8px]" onClick={() => {
                if (window.confirm("Подтвердить получение? Средства будут переведены продавцу.")) {
                  void runAction(() => confirmSafeDeal(uuid), "Получение подтверждено");
                }
              }}>
                <CheckCircle2 size={16} /> Подтвердить получение
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" disabled={busy} className="gap-[8px]" onClick={() => {
                if (window.confirm("Запросить возврат? Средства будут возвращены покупателю, сделка отменится.")) {
                  void runAction(() => cancelSafeDeal(uuid), "Возврат запрошен, средства возвращены покупателю");
                }
              }}>
                <XCircle size={16} /> Запросить возврат
              </Button>
            )}
            {canDispute && (
              <Button variant="ghost" disabled={busy} className="gap-[8px]" style={{ color: "var(--danger)" }} onClick={() => setDisputeOpen(true)}>
                <AlertTriangle size={16} /> Открыть спор
              </Button>
            )}
            {!holdOpen && (s === "paid" || s === "shipped" || s === "delivered") && (
              <p className="w-full text-[12px]" style={{ color: "var(--foreground-50)" }}>
                Срок холда истёк — открыть спор больше нельзя.
              </p>
            )}
          </div>
        )}

        {(deal.can_review || deal.my_review) && (
          <Card className="mt-[16px] p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>Оценка по сделке</h2>
            {deal.my_review ? (
              <p className="mt-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                Ваша оценка: {deal.my_review.rating} / 5{deal.my_review.text ? ` — ${deal.my_review.text}` : ""}
              </p>
            ) : (
              <RatingForm busy={busy} onSubmit={(rating, text) => void runAction(() => reviewSafeDeal(uuid, rating, text), "Оценка сохранена")} />
            )}
          </Card>
        )}
      </div>

      <ShipDialog open={shipOpen} onOpenChange={setShipOpen} busy={busy} onSubmit={(tracking, method) => {
        setShipOpen(false);
        void runAction(() => shipSafeDeal(uuid, { trackingNumber: tracking, deliveryMethod: method }), "Отмечено как отправлено");
      }} />
      <DisputeDialog open={disputeOpen} onOpenChange={setDisputeOpen} busy={busy} onSubmit={(reason, description, evidenceUuids) => {
        setDisputeOpen(false);
        void runAction(() => disputeSafeDeal(uuid, reason, description, evidenceUuids), "Спор открыт");
      }} />
      <DealReviewDialog
        open={reviewOpen && Boolean(deal.can_review) && role === "buyer"}
        busy={busy}
        onLater={() => {
          sessionStorage.setItem(reviewDismissedKey(uuid), "1");
          setReviewOpen(false);
        }}
        onSubmit={(rating, text) => {
          void runAction(() => reviewSafeDeal(uuid, rating, text), "Оценка сохранена").then((next) => {
            if (next) setReviewOpen(false);
          });
        }}
      />
    </AppLayout>
  );
}

function DealTimeline({ deal }: { deal: SafeDeal }) {
  const steps = [
    { key: "created", label: "Создан", done: Boolean(deal.paid_at) },
    { key: "paid", label: "Оплачен (Средства захолдированы)", done: Boolean(deal.paid_at) },
    { key: "handed", label: "Передан в СДЭК (Трек-номер)", done: Boolean(deal.shipped_at) || deal.delivery_status === "handed_to_cdek" || Boolean(deal.tracking_number) },
    { key: "transit", label: "В пути", done: deal.delivery_status === "in_transit" || deal.delivery_status === "at_pickup" || deal.delivery_status === "received" || deal.status === "delivered" || deal.status === "completed" },
    { key: "pvz", label: "Прибыл в ПВЗ", done: deal.delivery_status === "at_pickup" || deal.delivery_status === "received" || deal.status === "delivered" || deal.status === "completed" },
    { key: "received", label: "Получен покупателем", done: deal.delivery_status === "received" || deal.status === "delivered" || deal.status === "completed" },
    { key: "done", label: "Завершен (Деньги переведены продавцу)", done: deal.status === "completed" },
  ];
  return (
    <div className="mt-[12px] grid gap-[8px] text-[13px]">
      {steps.map((step) => (
        <div key={step.key} className="flex items-center justify-between gap-[12px]">
          <span style={{ color: step.done ? "var(--foreground)" : "var(--foreground-50)" }}>{step.label}</span>
          <span style={{ color: step.done ? "var(--success)" : "var(--foreground-50)" }}>{step.done ? "●" : "○"}</span>
        </div>
      ))}
      {deal.tracking_number && <Row label="Трек-номер" value={deal.tracking_number} />}
      {deal.auto_release_at && deal.status === "delivered" && <Row label="Автоподтверждение" value={fmt(deal.auto_release_at)} />}
    </div>
  );
}

function RatingForm({ busy, onSubmit }: { busy: boolean; onSubmit: (rating: number, text: string) => void }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  return (
    <div className="mt-[12px] space-y-[10px]">
      <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
        Рейтинг считается только по завершённым безопасным сделкам.
      </p>
      <div className="flex gap-[6px]">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="h-[36px] w-[36px] rounded-full text-[14px] font-bold"
            style={{
              background: rating >= n ? "var(--accent)" : "var(--background-surface)",
              color: rating >= n ? "var(--accent-foreground)" : "var(--foreground-50)",
            }}
            onClick={() => setRating(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="Комментарий (необязательно)" />
      <Button disabled={busy} onClick={() => onSubmit(rating, text.trim())}>Отправить оценку</Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-[12px]">
      <span style={{ color: "var(--foreground-50)" }}>{label}</span>
      <span className="text-right font-medium" style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function ShipDialog({ open, onOpenChange, busy, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; busy: boolean; onSubmit: (tracking: string, method: string) => void }) {
  const [tracking, setTracking] = useState("");
  const [method, setMethod] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>Отправка товара</DialogTitle>
        </DialogHeader>
        <div className="space-y-[14px]">
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Трек-номер (необязательно)</label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Способ доставки (необязательно)</label>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="СДЭК, Почта России…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Отмена</Button>
          <Button onClick={() => onSubmit(tracking, method)} disabled={busy}>Отправлено</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealReviewDialog({
  open,
  busy,
  onLater,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onLater: () => void;
  onSubmit: (rating: number, text: string) => void;
}) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onLater(); }}>
      <DialogContent className="max-w-[420px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>Оцените продавца</DialogTitle>
          <DialogDescription>Сделка завершена. Оценка появится в профиле продавца.</DialogDescription>
        </DialogHeader>
        <div className="space-y-[12px]">
          <div className="flex justify-center gap-[6px]">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="h-[40px] w-[40px] rounded-full text-[14px] font-bold"
                style={{
                  background: rating >= n ? "var(--accent)" : "var(--background-surface)",
                  color: rating >= n ? "var(--accent-foreground)" : "var(--foreground-50)",
                }}
                onClick={() => setRating(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="Комментарий (необязательно)" />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button disabled={busy} className="w-full" onClick={() => onSubmit(rating, text.trim())}>Отправить оценку</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onLater} disabled={busy}>Оценить позже</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisputeDialog({ open, onOpenChange, busy, onSubmit }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  onSubmit: (reason: string, description: string, evidenceUuids: string[]) => void;
}) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<{ uuid: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const remaining = 5 - files.length;
    const picked = Array.from(list).slice(0, remaining);
    if (picked.length === 0) return;
    setUploading(true);
    try {
      const uploaded: { uuid: string; name: string }[] = [];
      for (const file of picked) {
        const media = await uploadMedia(file, "dispute");
        uploaded.push({ uuid: media.uuid, name: file.name });
      }
      setFiles((prev) => [...prev, ...uploaded].slice(0, 5));
    } catch {
      toast.error("Не удалось загрузить файл");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setReason("");
        setDescription("");
        setFiles([]);
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-[400px]" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>Открыть спор</DialogTitle>
        </DialogHeader>
        <div className="space-y-[14px]">
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Причина</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} placeholder="Товар не соответствует описанию" />
          </div>
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Описание (необязательно)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} />
          </div>
          <div className="space-y-[6px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Файлы (до 5)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading || files.length >= 5} onClick={() => fileRef.current?.click()} className="gap-[6px]">
              <Paperclip size={14} /> {uploading ? "Загрузка…" : "Прикрепить"}
            </Button>
            {files.length > 0 && (
              <ul className="space-y-[4px]">
                {files.map((f) => (
                  <li key={f.uuid} className="flex items-center justify-between gap-[8px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((x) => x.uuid !== f.uuid))} aria-label="Удалить файл">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy || uploading}>Отмена</Button>
          <Button disabled={busy || uploading || reason.trim().length === 0} style={{ background: "var(--danger)", color: "#fff" }} onClick={() => onSubmit(reason.trim(), description.trim(), files.map((f) => f.uuid))}>Открыть спор</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
