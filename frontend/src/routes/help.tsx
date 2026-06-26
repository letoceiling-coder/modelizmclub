import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { faqCategories, faqItems, type FAQItem } from "@/lib/mock";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: tStatic("help.metaTitle") }] }),
  component: HelpPage,
});

function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<FAQItem["category"] | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqItems.filter((i) => {
      const matchCat = cat === "all" || i.category === cat;
      const matchQ = !q || i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [query, cat]);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[900px]">
        {/* Header */}
        <span
          className="inline-block uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "2px",
            color: "var(--foreground-50)",
            padding: "4px 12px",
            background: "var(--accent-soft)",
            borderRadius: "var(--r-tag)",
          }}
        >{t("help.badge")}</span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--fs-h2)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "var(--foreground)",
            marginTop: "16px",
          }}
        >{t("help.pageTitle")}</h1>
        <p style={{ fontSize: "var(--fs-body-lg)", lineHeight: 1.6, color: "var(--foreground-70)", marginTop: "12px", maxWidth: "600px" }}>{t("help.subtitle")}</p>

        {/* Search */}
        <div style={{ marginTop: "32px", position: "relative" }}>
          <Search size={20} style={{ position: "absolute", left: "18px", top: "18px", color: "var(--foreground-30)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("help.searchPlaceholder")}
            className="w-full outline-none"
            style={{
              height: "56px",
              background: "var(--background-elevated)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--r-input)",
              padding: "0 20px 0 52px",
              fontSize: "16px",
              color: "var(--foreground)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "var(--shadow-glow-accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Tabs */}
        <div
          className="no-scrollbar"
          style={{ marginTop: "24px", display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}
        >
          {faqCategories.map((c) => {
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "#fff" : "var(--foreground-70)",
                  background: active ? "var(--accent)" : "transparent",
                  borderRadius: "var(--r-pill)",
                  whiteSpace: "nowrap",
                  transition: "background 150ms ease, color 150ms ease",
                  minHeight: "36px",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--accent-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Accordion */}
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <AnimatePresence initial={false}>
            {filtered.map((item) => {
              const isOpen = openId === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    background: isOpen ? "var(--accent-soft)" : "var(--background-elevated)",
                    border: isOpen ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: "var(--r-card)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex w-full items-center justify-between text-left"
                    style={{
                      padding: isOpen ? "20px 24px 12px 24px" : "16px 20px",
                      minHeight: "52px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: isOpen ? 600 : 500,
                        fontSize: "16px",
                        color: isOpen ? "var(--accent)" : "var(--foreground)",
                      }}
                    >
                      {item.question}
                    </span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <ChevronDown size={18} style={{ color: isOpen ? "var(--accent)" : "var(--foreground-30)" }} />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        style={{ overflow: "hidden" }}
                      >
                        <p
                          style={{
                            padding: "0 24px 24px 24px",
                            fontSize: "15px",
                            color: "var(--foreground-70)",
                            lineHeight: 1.7,
                          }}
                        >
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                background: "var(--background-elevated)",
                borderRadius: "var(--r-card)",
                color: "var(--foreground-50)",
                fontSize: "14px",
              }}
            >{t("help.empty")}</div>
          )}
        </div>

        {/* Contact */}
        <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h3)", color: "var(--foreground)" }}>{t("help.contactTitle")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic || !email || !msg) return toast.error(t("help.contactFillAll"));
              toast.success(t("help.contactSuccess"));
              setTopic(""); setEmail(""); setMsg("");
            }}
            style={{ maxWidth: "560px", marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="outline-none"
              style={{
                height: "48px",
                background: "var(--background-elevated)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-input)",
                padding: "0 16px",
                fontSize: "14px",
                color: "var(--foreground)",
              }}
            >
              <option value="">{t("help.contactTopicPlaceholder")}</option>
              <option>{t("help.contactTopicPayment")}</option>
              <option>{t("help.contactTopicAd")}</option>
              <option>{t("help.contactTopicAccount")}</option>
              <option>{t("help.contactTopicReport")}</option>
              <option>{t("help.contactTopicSuggestion")}</option>
              <option>{t("help.contactTopicOther")}</option>
            </select>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="outline-none"
              style={{
                height: "48px",
                background: "var(--background-elevated)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-input)",
                padding: "0 16px",
                fontSize: "14px",
                color: "var(--foreground)",
              }}
            />
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={t("help.contactMessagePlaceholder")}
              className="outline-none"
              style={{
                height: "140px",
                background: "var(--background-elevated)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-input)",
                padding: "12px 16px",
                fontSize: "14px",
                color: "var(--foreground)",
                resize: "vertical",
                fontFamily: "var(--font-sans)",
              }}
            />
            <button
              type="submit"
              style={{
                height: "48px",
                padding: "0 32px",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "15px",
                borderRadius: "var(--r-button)",
                marginTop: "4px",
                width: "fit-content",
                transition: "background 200ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
            >{t("messenger.send")}</button>
          </form>
        </div>

        {/* Telegram */}
        <div
          style={{
            marginTop: "24px",
            background: "var(--background-elevated)",
            borderRadius: "var(--r-card)",
            padding: "20px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background: "var(--accent-soft)",
              padding: "10px",
              borderRadius: "var(--r-pill)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Send size={24} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ flex: 1, minWidth: "180px" }}>
            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{t("help.telegramTitle")}</div>
            <div style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("help.telegramDesc")}</div>
          </div>
          <a
            href="https://t.me/modelizm_forum_support"
            target="_blank"
            rel="noreferrer"
            style={{
              height: "40px",
              padding: "0 20px",
              background: "#0088CC",
              color: "#fff",
              fontWeight: 600,
              fontSize: "13px",
              borderRadius: "var(--r-button)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "background 200ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#006699")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#0088CC")}
          >
            <Send size={14} />{t("help.telegramCta")}</a>
        </div>
      </div>
    </AppLayout>
  );
}
