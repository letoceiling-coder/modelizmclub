import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "@/lib/toast";
import type { PromoCode } from "@/lib/mock";
import {
  fetchAdminPlansDetailed,
  updateAdminPlan,
  fetchAdminPromocodes,
  createPromocode,
  deletePromocode,
  fetchAdminSettings,
  updateAdminSettings,
  type AdminPlanRow,
} from "@/lib/api/admin";
import { PromoPoolsAdminCard } from "@/components/admin/PromoPoolsAdminCard";
import { FirstHundredAdminCard } from "@/components/admin/FirstHundredAdminCard";
import { ReferralProgramAdminCard } from "@/components/admin/ReferralProgramAdminCard";
import { AdminPaymentsAdminCard } from "@/components/admin/AdminPaymentsAdminCard";
import { AdminBillingOpsCard } from "@/components/admin/AdminBillingOpsCard";
import { H, card, inputStyle, primaryBtn, IconBtn } from "@/components/admin/adminShared";

export function MonetizationSection() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [defaultPlacementRub, setDefaultPlacementRub] = useState(30);
  const [registeredPlacementRub, setRegisteredPlacementRub] = useState(20);
  const [guestPlacementRub, setGuestPlacementRub] = useState(30);
  const [subscriberPlacementRub, setSubscriberPlacementRub] = useState(20);
  const [savingPlacement, setSavingPlacement] = useState(false);

  const reloadPromos = () =>
    fetchAdminPromocodes()
      .then(setPromos)
      .catch(() => {});

  useEffect(() => {
    let active = true;
    fetchAdminPlansDetailed()
      .then((p) => active && setPlans(p))
      .catch(() => {});
    fetchAdminPromocodes()
      .then((p) => active && setPromos(p))
      .catch(() => {});
    fetchAdminSettings()
      .then((s) => {
        if (!active) return;
        const readCents = (key: string, fallback: number) => {
          const row = s.find((x) => x.key === key);
          const cents = (row?.value as { cents?: number | null } | undefined)?.cents;
          return typeof cents === "number" ? Math.round(cents / 100) : fallback;
        };
        setDefaultPlacementRub(readCents("listing.placement.default_price_cents", 30));
        setRegisteredPlacementRub(readCents("listing.placement.registered_price_cents", 20));
        setGuestPlacementRub(readCents("listing.placement.guest_price_cents", 30));
        const subRow = s.find((x) => x.key === "listing.placement.subscriber_default_price_cents");
        const subCents = (subRow?.value as { cents?: number | null } | undefined)?.cents;
        setSubscriberPlacementRub(typeof subCents === "number" ? Math.round(subCents / 100) : 20);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const savePlans = async () => {
    try {
      await Promise.all(
        plans.map((plan) =>
          updateAdminPlan(plan.slug, {
            name: plan.name,
            price_cents: plan.priceCents,
            period_days: plan.periodDays,
            free_listings_per_month: plan.freeListingsPerMonth,
            listing_discount_percent: plan.listingDiscountPercent,
            is_active: plan.isActive,
          }),
        ),
      );
      toast.success(t("pages.adminMonetization.plansSaved"));
    } catch {
      toast.error(t("pages.adminMonetization.plansSaveFailed"));
    }
  };

  const savePlacementPricing = async () => {
    setSavingPlacement(true);
    try {
      await updateAdminSettings([
        {
          key: "listing.placement.registered_price_cents",
          value: { cents: Math.max(0, Math.round(registeredPlacementRub * 100)) },
          group: "billing",
        },
        {
          key: "listing.placement.guest_price_cents",
          value: { cents: Math.max(0, Math.round(guestPlacementRub * 100)) },
          group: "billing",
        },
        {
          key: "listing.placement.subscriber_default_price_cents",
          value: {
            cents: Math.max(0, Math.round(subscriberPlacementRub * 100)),
          },
          group: "billing",
        },
        {
          key: "listing.placement.default_price_cents",
          value: { cents: Math.max(0, Math.round(registeredPlacementRub * 100)) },
          group: "billing",
        },
      ]);
      toast.success(t("pages.adminMonetization.placementPriceSaved"));
      setDefaultPlacementRub(registeredPlacementRub);
    } catch {
      toast.error(t("pages.adminMonetization.placementPriceSaveFailed"));
    } finally {
      setSavingPlacement(false);
    }
  };

  return (
    <div>
      <H>{t("pages.adminMonetization.title")}</H>

      <PromoPoolsAdminCard cardStyle={card} />
      <FirstHundredAdminCard cardStyle={card} />

      <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
          }}
        >
          {t("pages.adminMonetization.placementTitle")}
        </h4>
        <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: "6px" }}>
          {t("pages.adminMonetization.placementHint")}
        </p>
        <div className="flex flex-wrap items-end gap-[10px]" style={{ marginTop: "12px" }}>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
              {t("pages.adminMonetization.registeredPriceLabel")}
            </span>
            <input
              type="number"
              min={0}
              value={registeredPlacementRub}
              onChange={(e) => setRegisteredPlacementRub(+e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            />
          </label>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
              {t("pages.adminMonetization.guestPriceLabel")}
            </span>
            <input
              type="number"
              min={0}
              value={guestPlacementRub}
              onChange={(e) => setGuestPlacementRub(+e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            />
          </label>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
              {t("pages.adminMonetization.subscriberPriceLabel")}
            </span>
            <input
              type="number"
              min={0}
              value={subscriberPlacementRub}
              onChange={(e) => setSubscriberPlacementRub(Math.max(0, +e.target.value))}
              style={{ ...inputStyle, width: 140 }}
            />
          </label>
          <button onClick={savePlacementPricing} disabled={savingPlacement} style={primaryBtn}>
            {savingPlacement ? "…" : t("pages.adminCommon.save")}
          </button>
        </div>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "10px" }}>
          {t("pages.adminMonetization.placementLegacyNote", { price: registeredPlacementRub })}
        </p>
      </div>

      {/* Tariffs */}
      <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
          }}
        >
          {t("pages.adminMonetization.tariffsTitle")}
        </h4>
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          style={{ gap: "12px", marginTop: "12px" }}
        >
          {plans.map((plan, i) => (
            <div
              key={plan.slug}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card-sm)",
                padding: "12px",
              }}
            >
              <input
                value={plan.name}
                onChange={(e) =>
                  setPlans((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                className="w-full outline-none"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
              />
              <input
                type="number"
                value={Math.round(plan.priceCents / 100)}
                onChange={(e) =>
                  setPlans((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, priceCents: Math.max(0, +e.target.value) * 100 } : x,
                    ),
                  )
                }
                className="w-full outline-none"
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--accent)",
                  background: "transparent",
                  border: "none",
                  padding: "4px 0",
                  fontFamily: "var(--font-display)",
                }}
              />
              <label
                className="flex items-center gap-2"
                style={{ marginTop: "8px", fontSize: "12px", color: "var(--foreground-70)" }}
              >
                <input
                  type="checkbox"
                  checked={plan.isActive}
                  onChange={(e) =>
                    setPlans((p) =>
                      p.map((x, j) => (j === i ? { ...x, isActive: e.target.checked } : x)),
                    )
                  }
                  style={{ accentColor: "var(--accent)" }}
                />
                {t("pages.adminMonetization.planActiveLabel")}
              </label>
              <label style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                  {t("pages.adminMonetization.periodDaysLabel")}
                </span>
                <input
                  type="number"
                  min={1}
                  value={plan.periodDays}
                  onChange={(e) =>
                    setPlans((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, periodDays: Math.max(1, +e.target.value) } : x,
                      ),
                    )
                  }
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                  {t("pages.adminMonetization.freeListingsLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  value={plan.freeListingsPerMonth}
                  onChange={(e) =>
                    setPlans((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, freeListingsPerMonth: +e.target.value } : x,
                      ),
                    )
                  }
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                  {t("pages.adminMonetization.discountLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={plan.listingDiscountPercent}
                  onChange={(e) =>
                    setPlans((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, listingDiscountPercent: +e.target.value } : x,
                      ),
                    )
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          ))}
        </div>
        <button onClick={savePlans} style={{ ...primaryBtn, marginTop: "12px" }}>
          {t("pages.adminMonetization.savePlans")}
        </button>
      </div>

      {/* Promocodes */}
      <PromoCodesBlock promos={promos} setPromos={setPromos} reload={reloadPromos} />

      <ReferralProgramAdminCard cardStyle={card} />

      <AdminPaymentsAdminCard cardStyle={card} />

      <AdminBillingOpsCard cardStyle={card} />
    </div>
  );
}

function PromoCodesBlock({
  promos,
  setPromos,
  reload,
}: {
  promos: PromoCode[];
  setPromos: Dispatch<SetStateAction<PromoCode[]>>;
  reload?: () => void;
}) {
  const { t } = useTranslation();
  const promoColumns = useMemo(
    () => [
      t("pages.adminPromocodes.columns.code"),
      t("pages.adminPromocodes.columns.discount"),
      t("pages.adminPromocodes.columns.used"),
      t("pages.adminPromocodes.columns.expires"),
      t("pages.adminPromocodes.columns.status"),
      "",
    ],
    [t],
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [form, setForm] = useState({
    code: "",
    discount: 10,
    expiresAt: "",
    limit: 100,
    type: "percent" as "percent" | "fixed" | "free",
    notifyAll: false,
    notifyUserIds: "",
    notifyTitle: "",
    notifyBody: "",
  });

  const today = new Date().toISOString().slice(0, 10);
  const enriched = promos.map((p) => ({
    ...p,
    status: (p.status ?? (p.expiresAt >= today ? "active" : "expired")) as "active" | "expired",
  }));

  const filtered = enriched.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (q && !p.code.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const create = async () => {
    if (!form.code.trim()) return toast.error(t("pages.adminPromocodes.errCode"));
    if (!form.expiresAt) return toast.error(t("pages.adminPromocodes.errExpires"));
    if (form.type === "percent" && (form.discount < 1 || form.discount > 100))
      return toast.error(t("pages.adminPromocodes.errDiscount"));
    if (form.limit < 1) return toast.error(t("pages.adminPromocodes.errLimit"));
    try {
      const notifyMode = form.notifyUserIds.trim() ? "selected" : form.notifyAll ? "all" : "none";
      const result = await createPromocode({
        code: form.code.toUpperCase(),
        type: form.type,
        scope: "listing_placement",
        value: form.type === "free" ? 100 : form.discount,
        max_usages: form.limit,
        valid_until: form.expiresAt,
        notify_mode: notifyMode,
        notify_title: form.notifyTitle.trim() || undefined,
        notify_body: form.notifyBody.trim() || undefined,
        notify_user_ids: form.notifyUserIds
          .split(/[\s,;]+/)
          .map((x) => +x)
          .filter((x) => Number.isInteger(x) && x > 0),
      });
      setForm({
        code: "",
        discount: 10,
        expiresAt: "",
        limit: 100,
        type: "percent",
        notifyAll: false,
        notifyUserIds: "",
        notifyTitle: "",
        notifyBody: "",
      });
      setOpen(false);
      reload?.();
      toast.success(
        result.notifications_sent
          ? t("pages.adminPromocodes.createdWithNotify", { count: result.notifications_sent })
          : t("pages.adminPromocodes.created"),
      );
    } catch {
      toast.error(t("pages.adminPromocodes.createFailed"));
    }
  };

  return (
    <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
      <div className="flex items-center justify-between flex-wrap gap-[12px]">
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
          }}
        >
          {t("pages.adminPromocodes.title")}
        </h4>
        <button onClick={() => setOpen((v) => !v)} style={primaryBtn}>
          <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />
          {t("pages.adminPromocodes.create")}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                marginTop: "12px",
                padding: "16px",
                background: "var(--background-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card-sm)",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                  >
                    {t("pages.adminPromocodes.fieldCode")}
                  </span>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="SUMMER2026"
                    className="outline-none"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                  >
                    {t("pages.adminPromocodes.fieldType")}
                  </span>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as "percent" | "fixed" | "free" })
                    }
                    style={inputStyle}
                  >
                    <option value="percent">{t("pages.adminPromocodes.typePercent")}</option>
                    <option value="fixed">{t("pages.adminPromocodes.typeFixed")}</option>
                    <option value="free">{t("pages.adminPromocodes.typeFree")}</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                  >
                    {t("pages.adminPromocodes.fieldDiscount")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.discount}
                    disabled={form.type !== "percent"}
                    onChange={(e) => setForm({ ...form, discount: +e.target.value })}
                    className="outline-none"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                  >
                    {t("pages.adminPromocodes.fieldExpires")}
                  </span>
                  <input
                    type="date"
                    required
                    value={form.expiresAt}
                    min={today}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="outline-none"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                  >
                    {t("pages.adminPromocodes.fieldLimit")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={form.limit}
                    onChange={(e) => setForm({ ...form, limit: +e.target.value })}
                    className="outline-none"
                    style={inputStyle}
                  />
                </label>
                <label
                  className="md:col-span-2 flex items-center gap-[8px] text-[13px]"
                  style={{ color: "var(--foreground-70)" }}
                >
                  <input
                    type="checkbox"
                    checked={form.notifyAll}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notifyAll: e.target.checked,
                        notifyUserIds: e.target.checked ? "" : form.notifyUserIds,
                      })
                    }
                  />
                  {t("pages.adminPromocodes.notifyAll")}
                </label>
                <label
                  className="md:col-span-2"
                  style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                >
                  <span
                    style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                  >
                    {t("pages.adminPromocodes.notifyUserIds")}
                  </span>
                  <input
                    value={form.notifyUserIds}
                    onChange={(e) =>
                      setForm({ ...form, notifyUserIds: e.target.value, notifyAll: false })
                    }
                    placeholder="12, 45, 78"
                    style={inputStyle}
                  />
                </label>
                {form.notifyAll && (
                  <>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span
                        style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                      >
                        {t("pages.adminPromocodes.notifyTitle")}
                      </span>
                      <input
                        value={form.notifyTitle}
                        onChange={(e) => setForm({ ...form, notifyTitle: e.target.value })}
                        placeholder={t("pages.adminPromocodes.notifyTitlePlaceholder")}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span
                        style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}
                      >
                        {t("pages.adminPromocodes.notifyBody")}
                      </span>
                      <input
                        value={form.notifyBody}
                        onChange={(e) => setForm({ ...form, notifyBody: e.target.value })}
                        placeholder={t("pages.adminPromocodes.notifyBodyPlaceholder")}
                        style={inputStyle}
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="flex gap-[8px]" style={{ marginTop: "12px" }}>
                <button onClick={create} style={primaryBtn}>
                  {t("pages.adminPromocodes.submit")}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    ...primaryBtn,
                    background: "transparent",
                    color: "var(--foreground-70)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {t("pages.adminCommon.cancel")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center" style={{ gap: "8px", marginTop: "12px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--foreground-50)",
            }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("pages.adminPromocodes.searchPlaceholder")}
            className="w-full outline-none"
            style={{ ...inputStyle, paddingLeft: "34px" }}
          />
        </div>
        <div
          className="flex"
          style={{
            gap: "4px",
            background: "var(--background-surface)",
            padding: "3px",
            borderRadius: "var(--r-pill)",
          }}
        >
          {(["all", "active", "expired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "var(--r-pill)",
                background: filter === f ? "var(--background)" : "transparent",
                color: filter === f ? "var(--accent)" : "var(--foreground-70)",
              }}
            >
              {t(`pages.adminPromocodes.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: "12px", overflowX: "auto" }}>
        <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
          <thead>
            <tr style={{ background: "var(--background-surface)" }}>
              {promoColumns.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--foreground-50)",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {p.code}
                </td>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--accent)" }}>
                  {p.discount}%
                </td>
                <td style={{ padding: "10px 12px", color: "var(--foreground-70)" }}>
                  {p.usedCount} / {p.limit}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--foreground-70)" }}>
                  {p.expiresAt}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: "var(--r-pill)",
                      background:
                        p.status === "active"
                          ? "var(--success-soft, rgba(34,197,94,0.12))"
                          : "var(--background-surface)",
                      color:
                        p.status === "active" ? "var(--success, #16a34a)" : "var(--foreground-50)",
                    }}
                  >
                    {p.status === "active"
                      ? t("pages.adminPromocodes.statusActive")
                      : t("pages.adminPromocodes.statusExpired")}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <IconBtn
                    danger
                    onClick={async () => {
                      try {
                        await deletePromocode(p.code);
                        setPromos((q) => q.filter((x) => x.id !== p.id));
                        toast.success(t("pages.adminPromocodes.deleted"));
                      } catch {
                        toast.error(t("pages.adminPromocodes.deleteFailed"));
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </IconBtn>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ padding: "24px", textAlign: "center", color: "var(--foreground-50)" }}
                >
                  {t("pages.adminPromocodes.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
