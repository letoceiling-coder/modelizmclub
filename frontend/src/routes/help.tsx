import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchFaq } from "@/lib/api/content";
import { submitFeedback } from "@/lib/api/feedback";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { getToken } from "@/lib/api/client";

interface FaqTab {
  id: string;
  label: string;
}
interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
}

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: i18n.t("pages.help.metaTitle") }] }),
  component: HelpPage,
});

const TOPIC_OPTIONS = [
  { value: "payment", labelKey: "pages.help.topicPayment" },
  { value: "listing", labelKey: "pages.help.topicListing" },
  { value: "account", labelKey: "pages.help.topicAccount" },
  { value: "report", labelKey: "pages.help.topicReport" },
  { value: "suggestion", labelKey: "pages.help.topicSuggestion" },
  { value: "other", labelKey: "pages.help.topicOther" },
] as const;

function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const [faqCategories, setFaqCategories] = useState<FaqTab[]>([{ id: "all", label: t("pages.help.all") }]);
  const [faqItems, setFaqItems] = useState<FaqEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetchFaq()
      .then((cats) => {
        if (!active) return;
        const helpCats = cats.filter((c) => c.slug !== "landing");
        setFaqCategories([
          { id: "all", label: t("pages.help.all") },
          ...helpCats.map((c) => ({ id: c.slug, label: c.name })),
        ]);
        setFaqItems(
          helpCats.flatMap((c) =>
            c.articles.map((a) => ({
              id: String(a.id),
              question: a.question,
              answer: a.answer,
              category: c.slug,
            })),
          ),
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqItems.filter((i) => {
      const matchCat = cat === "all" || i.category === cat;
      const matchQ = !q || i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [query, cat, faqItems]);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[900px]">
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
        >
          {t("pages.help.eyebrow")}
        </span>
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
        >
          {t("pages.help.title")}
        </h1>
        <p style={{ fontSize: "var(--fs-body-lg)", lineHeight: 1.6, color: "var(--foreground-70)", marginTop: "12px", maxWidth: "600px" }}>
          {t("pages.help.subtitle")}
        </p>

        <div style={{ marginTop: "32px", position: "relative" }}>
          <Search size={20} style={{ position: "absolute", left: "18px", top: "18px", color: "var(--foreground-30)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pages.help.searchPlaceholder")}
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
            >
              {t("pages.help.nothingFound")}
            </div>
          )}
        </div>

        <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h3)", color: "var(--foreground)" }}>
            {t("pages.help.contactTitle")}
          </h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmedMsg = msg.trim();
              const trimmedEmail = email.trim();
              if (!topic || !trimmedMsg) return toast.error(t("pages.help.fillAllFields"));
              if (!getToken() && !trimmedEmail) return toast.error(t("pages.help.fillAllFields"));
              const topicLabel = TOPIC_OPTIONS.find((o) => o.value === topic);
              setSending(true);
              try {
                await submitFeedback({
                  subject: topicLabel ? t(topicLabel.labelKey) : topic,
                  message: trimmedMsg,
                  page: "/help",
                  guestEmail: getToken() ? undefined : trimmedEmail,
                });
                toast.success(t("pages.help.sent"));
                setTopic("");
                setEmail("");
                setMsg("");
              } catch (err) {
                toast.error(formatApiErrorMessage(err, t("pages.help.sendFailed", "Не удалось отправить. Попробуйте позже")));
              } finally {
                setSending(false);
              }
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
              <option value="">{t("pages.help.selectTopic")}</option>
              {TOPIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("pages.help.emailPlaceholder")}
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
              placeholder={t("pages.help.messagePlaceholder")}
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
              disabled={sending}
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
            >
              {sending ? t("pages.help.sending", "Отправка…") : t("pages.help.send")}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
