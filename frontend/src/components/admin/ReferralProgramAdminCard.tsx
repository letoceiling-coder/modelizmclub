import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { fetchAdminReferrals, updateAdminSettings, type AdminReferralRow } from "@/lib/api/admin";

type CardStyle = React.CSSProperties;

export function ReferralProgramAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [enabled, setEnabled] = useState(true);
  const [perInvite, setPerInvite] = useState(1);
  const [maxBonus, setMaxBonus] = useState(10);
  const [rewardListing, setRewardListing] = useState(true);
  const [rewardDays, setRewardDays] = useState(0);
  const [rows, setRows] = useState<AdminReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchAdminReferrals()
      .then(({ settings, data }) => {
        setEnabled(settings.enabled);
        setPerInvite(settings.per_invite);
        setMaxBonus(settings.max_bonus);
        setRewardListing(settings.reward_listing_credits !== false);
        setRewardDays(settings.reward_subscription_days ?? 0);
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
            per_invite: perInvite,
            max_bonus: maxBonus,
            reward_listing_credits: rewardListing,
            reward_subscription_days: rewardDays,
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
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
  };

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>
        Реферальная программа
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        Бонус пригласившему начисляется только после подтверждения телефона другом. Можно выдать бесплатные объявления и/или дни подписки.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Программа активна
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>За друга</span>
          <input type="number" min={1} value={perInvite} onChange={(e) => setPerInvite(+e.target.value)} style={{ ...inputStyle, width: 100 }} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>Максимум бонусов</span>
          <input type="number" min={1} value={maxBonus} onChange={(e) => setMaxBonus(+e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </label>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
          <input type="checkbox" checked={rewardListing} onChange={(e) => setRewardListing(e.target.checked)} />
          +N бесплатных объявлений
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>Дней подписки за друга</span>
          <input type="number" min={0} value={rewardDays} onChange={(e) => setRewardDays(+e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </label>
        <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? "…" : "Сохранить"}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Приглашений пока нет.</p>
        ) : (
          <table className="w-full min-w-[520px] text-left text-[13px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--foreground-50)", borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-3 font-medium">Кого пригласил</th>
                <th className="py-2 pr-3 font-medium">Приглашённый</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
                <th className="py-2 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.invitee.uuid}-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground)" }}>
                    {row.inviter?.display_name ?? "—"}
                    {row.inviter?.referral_code ? (
                      <span style={{ color: "var(--foreground-50)", marginLeft: 6 }}>{row.inviter.referral_code}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-70)" }}>{row.invitee.display_name}</td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-50)" }}>
                    {row.status === "completed" || row.phone_verified ? "Бонус начислен" : "Ждёт телефон"}
                  </td>
                  <td className="py-2" style={{ color: "var(--foreground-50)" }}>
                    {row.joined_at ? new Date(row.joined_at).toLocaleDateString("ru-RU") : "—"}
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
