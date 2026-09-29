import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  fetchAdminReferrals,
  updateAdminSettings,
  REFERRAL_SETTINGS_FALLBACK,
  type AdminReferralRow,
  type ReferralSettings,
} from "@/lib/api/admin";
import { formatDate } from "@/lib/format/date";
import { итогПриглашения } from "@/lib/referral";

type CardStyle = React.CSSProperties;

export function ReferralProgramAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [enabled, setEnabled] = useState(true);
  /** Баллов за одного приглашённого. */
  const [pointsPerInvite, setPointsPerInvite] = useState(100);
  /** Сколько приглашений оплачивается; ноль — без предела. */
  const [maxPaidInvites, setMaxPaidInvites] = useState(0);
  const [terms, setTerms] = useState("");
  /** Что сейчас сохранено — чтобы показать действующие настройки рядом с полями. */
  const [saved, setSaved] = useState<ReferralSettings>(REFERRAL_SETTINGS_FALLBACK);
  const [rows, setRows] = useState<AdminReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchAdminReferrals()
      .then(({ settings, data }) => {
        setEnabled(settings.enabled);
        setPointsPerInvite(settings.points_per_invite);
        setMaxPaidInvites(settings.max_paid_invites);
        setTerms(settings.terms);
        setSaved(settings);
        setRows(data);
      })
      .catch(() => toast.error("Не удалось загрузить реферальную программу"))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings([
        {
          key: "referral_program",
          group: "marketing",
          value: {
            enabled,
            points_per_invite: pointsPerInvite,
            max_paid_invites: maxPaidInvites,
            terms,
          },
        },
      ]);
      toast.success("Настройки реферальной программы сохранены");
      reload();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    fontSize: 13,
    color: "var(--foreground)",
  };

  const primaryBtn: React.CSSProperties = {
    height: 36,
    padding: "0 16px",
    borderRadius: 8,
    background: "var(--accent-fill)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
  };

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <h4
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 16,
          color: "var(--foreground)",
        }}
      >
        Реферальная программа
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        Баллы начисляются пригласившему после того, как друг подтвердит телефон. Переход по ссылке
        награды не даёт. Баллы не выводятся деньгами — это отдельный счёт, не кошелёк.
      </p>

      {/*
        Что сейчас действует — рядом с полями, а не вместо них.
        Поля показывают правку, которую ещё не сохранили; эта строка — то,
        по чему сервер начисляет прямо сейчас.
      */}
      <p style={{ fontSize: 12, color: "var(--foreground-50)", marginTop: 8 }}>
        Сейчас действует: {saved.enabled ? "акция включена" : "акция выключена"} ·{" "}
        {saved.points_per_invite} балл(ов) за друга ·{" "}
        {saved.max_paid_invites > 0
          ? `оплачивается первых ${saved.max_paid_invites} приглашений`
          : "без предела по числу приглашений"}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label
          className="flex items-center gap-2 text-[13px]"
          style={{ color: "var(--foreground-70)" }}
        >
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Программа активна
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>Баллов за друга</span>
          <input
            type="number"
            min={0}
            max={10000}
            value={pointsPerInvite}
            onChange={(e) => setPointsPerInvite(Math.max(0, +e.target.value))}
            style={{ ...inputStyle, width: 120 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>
            Оплачиваемых приглашений
          </span>
          <input
            type="number"
            min={0}
            value={maxPaidInvites}
            onChange={(e) => setMaxPaidInvites(Math.max(0, +e.target.value))}
            style={{ ...inputStyle, width: 160 }}
          />
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>0 — без предела</span>
        </label>
        <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? "…" : "Сохранить"}
        </button>
      </div>

      {/*
        Текст условий — он же выводится на странице «Пригласи друга».
        Один источник: иначе админка и страница разошлись бы при первой правке.
      */}
      <label style={{ display: "grid", gap: 4, marginTop: 12 }}>
        <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>
          Текст условий — виден людям на странице приглашений
        </span>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={3}
          maxLength={1000}
          style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-end gap-3"></div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Приглашений пока нет.</p>
        ) : (
          <table
            className="w-full min-w-[520px] text-left text-[13px]"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{ color: "var(--foreground-50)", borderBottom: "1px solid var(--border)" }}
              >
                <th className="py-2 pr-3 font-medium">Кого пригласил</th>
                <th className="py-2 pr-3 font-medium">Приглашённый</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
                <th className="py-2 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.invitee.uuid}-${i}`}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td className="py-2 pr-3" style={{ color: "var(--foreground)" }}>
                    {row.inviter?.display_name ?? "—"}
                    {row.inviter?.referral_code ? (
                      <span style={{ color: "var(--foreground-50)", marginLeft: 6 }}>
                        {row.inviter.referral_code}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-70)" }}>
                    {row.invitee.display_name}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-50)" }}>
                    {
                      итогПриглашения({
                        status: row.status ?? (row.phone_verified ? "completed" : "pending"),
                        points: row.points,
                        listingCredits: row.listing_credits,
                      }).подпись
                    }
                  </td>
                  <td className="py-2" style={{ color: "var(--foreground-50)" }}>
                    {row.joined_at ? formatDate(row.joined_at, "date") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
