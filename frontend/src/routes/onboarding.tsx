import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROUTE_SEARCH } from "@/lib/route-search";
import { fetchPostCategories, syncMyInterests } from "@/lib/api/catalog";
import { hasAuthForApi } from "@/lib/api/auth-api";
import type { Category } from "@/lib/types";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: tStatic("onboarding.metaTitle") }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { t } = useTranslation();
  const [interests, setInterests] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    void fetchPostCategories().then(setInterests).catch(() => setInterests([]));
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const finish = async () => {
    if (selected.length < 1) return toast.error(t("onboarding.errorMin"));
    setSaving(true);
    try {
      if (hasAuthForApi()) {
        await syncMyInterests(selected.map((id) => Number(id)).filter((n) => !Number.isNaN(n)));
      }
      toast.success(t("onboarding.success"));
      nav({ to: "/feed", search: ROUTE_SEARCH.feed });
    } catch {
      toast.error(t("onboarding.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <header
        className="sticky top-0 z-30 flex items-center justify-between backdrop-blur"
        style={{ padding: "16px var(--container-pad)", borderBottom: "1px solid var(--border)", background: "color-mix(in oklab, var(--background) 88%, transparent)" }}
      >
        <Logo />
        <div className="flex items-center gap-[12px]">
          <button
            onClick={() => nav({ to: "/feed", search: ROUTE_SEARCH.feed })}
            style={{ color: "var(--foreground-70)", fontSize: "var(--fs-sm)", background: "transparent", border: "none", cursor: "pointer" }}
          >{t("onboarding.skip")}</button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto" style={{ maxWidth: 920, padding: "64px var(--container-pad) 120px" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-xs)",
            color: "var(--accent)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >{t("onboarding.step")}</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 12 }}>{t("onboarding.title")}</h1>
        <p style={{ color: "var(--foreground-70)", fontSize: "var(--fs-body-lg)", marginTop: 12, maxWidth: 600 }}>{t("onboarding.subtitle")}</p>

        <div className="mt-[32px] grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((i) => {
            const active = selected.includes(i.id);
            return (
              <motion.button
                key={i.id}
                onClick={() => toggle(i.id)}
                whileTap={{ scale: 0.98 }}
                type="button"
                style={{
                  textAlign: "left",
                  background: active ? "var(--accent-soft)" : "var(--background-elevated)",
                  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: "var(--r-card)",
                  padding: "20px",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 200ms var(--ease-out-expo), border-color 200ms var(--ease-out-expo)",
                }}
              >
                {active && (
                  <div
                    className="absolute right-[16px] top-[16px] inline-flex items-center justify-center"
                    style={{ width: 24, height: 24, borderRadius: 999, background: "var(--accent)", color: "#fff" }}
                  >
                    <Check size={14} />
                  </div>
                )}
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h4)" }}>
                  {i.name}
                </div>
                {i.subcategories && i.subcategories.length > 0 && (
                  <div style={{ color: "var(--foreground-70)", fontSize: "var(--fs-sm)", marginTop: 6 }}>
                    {i.subcategories.slice(0, 4).map((s) => s.name).join(", ")}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        <div
          className="sticky bottom-[16px] mt-[40px] flex flex-wrap items-center justify-between gap-[12px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            padding: "16px 20px",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--foreground-70)" }}>
            {t("common.selected", { n: selected.length, total: interests.length })}
          </div>
          <button
            onClick={() => void finish()}
            disabled={saving}
            style={{
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "var(--fs-sm)",
              padding: "12px 24px",
              borderRadius: "var(--r-button)",
              border: "none",
              cursor: "pointer",
              boxShadow: "var(--shadow-button)",
            }}
          >{t("onboarding.continue")}</button>
        </div>
      </main>
    </div>
  );
}
