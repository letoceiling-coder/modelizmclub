import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "@/lib/toast";
import { updateAdminSettings } from "@/lib/api/admin";
import {
  EMPTY_FOOTER_CONTACTS_DRAFT,
  footerContactsFromDraft,
  footerContactsToDraft,
  type FooterContactsDraft,
} from "@/lib/footer-contacts";
import { fetchFooterContacts } from "@/lib/api/site";
import { invalidateFooterContactsCache } from "@/lib/hooks/useFooterContacts";

const FOOTER_CONTACTS_KEY = "footer.contacts";

const inputStyle: CSSProperties = {
  height: "40px",
  background: "var(--background)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
  width: "100%",
};

export function FooterContactsAdminCard({ cardStyle }: { cardStyle: CSSProperties }) {
  const [draft, setDraft] = useState<FooterContactsDraft>(EMPTY_FOOTER_CONTACTS_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFooterContacts()
      .then((data) => setDraft(footerContactsToDraft(data)))
      .catch(() => toast.error("Не удалось загрузить контакты футера"))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field: "email" | "phone" | "hours", value: string) =>
    setDraft((p) => ({ ...p, [field]: value }));

  const setSocialUrl = (label: string, url: string) =>
    setDraft((p) => ({
      ...p,
      social: p.social.map((s) => (s.label === label ? { ...s, url } : s)),
    }));

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings([
        {
          key: FOOTER_CONTACTS_KEY,
          value: footerContactsFromDraft(draft),
          group: "footer",
        },
      ]);
      invalidateFooterContactsCache();
      toast.success("Контакты футера сохранены");
    } catch {
      toast.error("Не удалось сохранить контакты");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...cardStyle, padding: "24px", maxWidth: "640px" }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "8px" }}>
        Контакты в футере
      </h4>
      <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
        Пустые поля не показываются на сайте. Соцсети — только с указанной ссылкой.
      </p>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузка…</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>Email</span>
            <input type="email" value={draft.email} onChange={(e) => setField("email", e.target.value)} className="outline-none" style={inputStyle} placeholder="support@modelizmclub.ru" />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>Телефон</span>
            <input type="text" value={draft.phone} onChange={(e) => setField("phone", e.target.value)} className="outline-none" style={inputStyle} placeholder="8 800 000-00-00" />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>Режим работы</span>
            <input type="text" value={draft.hours} onChange={(e) => setField("hours", e.target.value)} className="outline-none" style={inputStyle} placeholder="Пн–Вс, 10:00–20:00 МСК" />
          </label>

          <div style={{ display: "grid", gap: "10px", marginTop: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>Соцсети</span>
            {draft.social.map((s) => (
              <label key={s.label} style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-50)" }}>{s.label}</span>
                <input
                  type="url"
                  value={s.url}
                  onChange={(e) => setSocialUrl(s.label, e.target.value)}
                  className="outline-none"
                  style={inputStyle}
                  placeholder="https://"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || loading}
        style={{
          marginTop: "20px",
          height: "44px",
          padding: "0 32px",
          fontSize: "14px",
          borderRadius: "var(--r-button)",
          background: "var(--accent)",
          color: "var(--accent-foreground)",
          fontWeight: 600,
          opacity: saving || loading ? 0.7 : 1,
        }}
      >
        {saving ? "Сохраняем…" : "Сохранить контакты"}
      </button>
    </div>
  );
}
