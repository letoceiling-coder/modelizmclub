import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  deleteAdminListing,
  fetchAdminListing,
  updateAdminListing,
  type AdminListingDetail,
} from "@/lib/api/admin";

export const Route = createFileRoute("/admin/listings/$uuid")({
  head: () => ({ meta: [{ title: "Объявление — админ — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
  component: AdminListingPage,
});

const card: CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--background-elevated)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "10px 14px",
  fontSize: "13px",
  color: "var(--foreground)",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--foreground-50)",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "published", label: "Опубликовано" },
  { value: "pending_moderation", label: "На модерации" },
  { value: "awaiting_payment", label: "Ждёт оплаты" },
  { value: "revision", label: "На доработке" },
  { value: "rejected", label: "Отклонено" },
  { value: "draft", label: "Черновик" },
  { value: "unpublished", label: "Снято" },
  { value: "sold", label: "Продано" },
  { value: "expired", label: "Истекло" },
];

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info" | "published" | "moderation" | "rejected"> = {
  published: "published",
  pending_moderation: "moderation",
  awaiting_payment: "moderation",
  revision: "moderation",
  rejected: "rejected",
  draft: "default",
  unpublished: "default",
  sold: "default",
  expired: "default",
};

function AdminListingPage() {
  const { uuid } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState<AdminListingDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAdminListing(uuid)
      .then((item) => {
        if (!alive) return;
        setListing(item);
        setTitle(item.title);
        setDescription(item.description);
        setPrice(String(item.price || ""));
        setStatus(item.status);
        setRejectionReason(item.rejectionReason);
      })
      .catch(() => toast.error("Не удалось загрузить объявление"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [uuid]);

  const save = async () => {
    const priceNum = Number(price.replace(/\s/g, "").replace(",", "."));
    if (!title.trim()) {
      toast.error("Укажите заголовок");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Укажите корректную цену");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAdminListing(uuid, {
        title: title.trim(),
        description: description.trim(),
        price_cents: Math.round(priceNum * 100),
        status,
        rejection_reason: status === "rejected" ? rejectionReason.trim() || null : null,
      });
      setListing(updated);
      toast.success("Объявление сохранено");
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Удалить объявление?")) return;
    try {
      await deleteAdminListing(uuid);
      toast.success("Объявление удалено");
      navigate({ to: "/admin", search: { section: "ads" } });
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-[12px] px-[16px] py-[12px] sm:px-[24px]"
        style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex min-w-0 items-center gap-[12px]">
          <Logo size={28} />
          <Link
            to="/admin"
            search={{ section: "ads" }}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium"
            style={{ color: "var(--foreground-70)" }}
          >
            <ArrowLeft size={16} />
            К списку объявлений
          </Link>
        </div>
        <div className="flex items-center gap-[8px]">
          <ThemeToggle />
          <Link
            to="/ads/$id"
            params={{ id: uuid }}
            target="_blank"
            className="inline-flex items-center gap-[6px] rounded-[var(--r-button)] px-[12px] py-[8px] text-[13px] font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--foreground-70)" }}
          >
            <ExternalLink size={14} />
            На сайте
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-[16px] py-[24px] sm:px-[24px]">
        {loading ? (
          <div style={{ color: "var(--foreground-50)", fontSize: "14px" }}>Загрузка…</div>
        ) : !listing ? (
          <div style={{ color: "var(--foreground-50)", fontSize: "14px" }}>Объявление не найдено</div>
        ) : (
          <div className="space-y-[20px]">
            <div className="flex flex-wrap items-start justify-between gap-[12px]">
              <div>
                <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>
                  Объявление
                </h1>
                <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  {listing.author} · {listing.category}
                  {listing.subcategory ? ` / ${listing.subcategory}` : ""}
                  {listing.city ? ` · ${listing.city}` : ""}
                </p>
              </div>
              <StatusBadge variant={STATUS_VARIANT[status] ?? "default"}>{statusLabel}</StatusBadge>
            </div>

            {listing.images.length > 0 && (
              <div style={{ ...card, padding: "16px" }}>
                <div className="mb-[12px] text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--foreground-50)" }}>
                  Фотографии
                </div>
                <div className="flex flex-wrap gap-[10px]">
                  {listing.images.map((src, i) => (
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      width={120}
                      height={120}
                      loading="lazy"
                      decoding="async"
                      alt=""
                      className="h-[120px] w-[120px] rounded-[10px] object-cover"
                      style={{ border: i === 0 ? "2px solid var(--accent)" : "1px solid var(--border)" }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...card, padding: "20px" }} className="space-y-[16px]">
              <div>
                <label style={labelStyle}>Заголовок</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="outline-none" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="outline-none"
                  style={{ ...inputStyle, minHeight: "140px", resize: "vertical" }}
                />
              </div>

              <div className="grid gap-[16px] sm:grid-cols-2">
                <div>
                  <label style={labelStyle}>Цена, ₽</label>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} className="outline-none" style={inputStyle} inputMode="numeric" />
                </div>
                <div>
                  <label style={labelStyle}>Статус</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, height: "42px" }}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {status === "rejected" && (
                <div>
                  <label style={labelStyle}>Причина отклонения</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="outline-none"
                    style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                  />
                </div>
              )}

              <div className="grid gap-[12px] sm:grid-cols-3 text-[13px]" style={{ color: "var(--foreground-50)" }}>
                <div>Просмотры: <span style={{ color: "var(--foreground)" }}>{listing.viewsCount}</span></div>
                <div>В избранном: <span style={{ color: "var(--foreground)" }}>{listing.favoritesCount}</span></div>
                <div>Создано: <span style={{ color: "var(--foreground)" }}>{listing.createdAt ? new Date(listing.createdAt).toLocaleString("ru-RU") : "—"}</span></div>
              </div>

              <div className="flex flex-wrap gap-[10px] pt-[4px]">
                <Button onClick={() => void save()} disabled={saving} className="h-10 px-5">
                  {saving ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button variant="outline" onClick={() => void remove()} className="h-10 px-5" style={{ color: "var(--error)" }}>
                  <Trash2 size={14} className="mr-[6px]" />
                  Удалить
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
