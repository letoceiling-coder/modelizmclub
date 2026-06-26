import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import type { FaqCategory } from "@/lib/types";
import { fetchFaq } from "@/lib/api/public";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: tStatic("help.metaTitle") }] }),
  component: HelpPage,
});

function HelpPage() {
  const { t } = useTranslation();
  const [faq, setFaq] = useState<FaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchFaq()
      .then((items) => {
        if (!cancelled) setFaq(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allItems = useMemo(
    () =>
      faq.flatMap((c) =>
        c.articles.map((a) => ({
          id: a.id,
          category: c.slug,
          categoryName: c.name,
          question: a.question,
          answer: a.answer,
        })),
      ),
    [faq],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((i) => {
      const matchCat = cat === "all" || i.category === cat;
      const matchQ = !q || i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [query, cat, allItems]);

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
          />
        </div>

        <div className="no-scrollbar" style={{ marginTop: "24px", display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          <button
            onClick={() => setCat("all")}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: cat === "all" ? 600 : 500,
              color: cat === "all" ? "#fff" : "var(--foreground-70)",
              background: cat === "all" ? "var(--accent)" : "transparent",
              borderRadius: "var(--r-pill)",
              whiteSpace: "nowrap",
            }}
          >
            {t("help.allCategories")}
          </button>
          {faq.map((c) => {
            const active = cat === c.slug;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.slug)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "#fff" : "var(--foreground-70)",
                  background: active ? "var(--accent)" : "transparent",
                  borderRadius: "var(--r-pill)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--foreground-50)" }}>{t("common.loading")}</div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
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
                      style={{ padding: isOpen ? "20px 24px 12px 24px" : "16px 20px", minHeight: "52px" }}
                    >
                      <span style={{ fontWeight: isOpen ? 600 : 500, fontSize: "16px", color: isOpen ? "var(--accent)" : "var(--foreground)" }}>
                        {item.question}
                      </span>
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                        <ChevronDown size={18} style={{ color: isOpen ? "var(--accent)" : "var(--foreground-30)" }} />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: "hidden" }}
                        >
                          <p style={{ padding: "0 24px 24px 24px", fontSize: "15px", color: "var(--foreground-70)", lineHeight: 1.7 }}>
                            {item.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--background-elevated)", borderRadius: "var(--r-card)", color: "var(--foreground-50)", fontSize: "14px" }}>
              {t("help.empty")}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
