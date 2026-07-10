import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Выберите интересы — МоДелизМ" }] }),
  component: OnboardingPage,
});

const INTERESTS = [
  { id: "rc-cars", title: "RC автомодели", desc: "ДВС, электро, дрифт, ралли, краулеры" },
  { id: "rc-air", title: "Авиамодели", desc: "Планеры, пилотажки, копии" },
  { id: "fpv", title: "Квадрокоптеры / FPV", desc: "Гонки, фристайл, синема" },
  { id: "rc-boats", title: "Корабли и суда", desc: "Яхты, катера, копии" },
  { id: "electronics", title: "Электроника", desc: "Регуляторы, моторы, прошивки" },
  { id: "static", title: "Стендовый моделизм", desc: "Сборка, окраска, диорамы" },
  { id: "trade", title: "Купля/продажа", desc: "Запчасти и готовые модели" },
  { id: "events", title: "События и заезды", desc: "Локальные клубы и чемпионаты" },
];

function OnboardingPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const nav = useNavigate();

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const finish = () => {
    if (selected.length < 1) return toast.error("Выберите хотя бы одну категорию");
    toast.success("Готово! Лента подобрана под ваши интересы");
    nav({ to: "/feed" });
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
            onClick={() => nav({ to: "/feed" })}
            style={{ color: "var(--foreground-70)", fontSize: "var(--fs-sm)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            Пропустить
          </button>
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
        >
          Шаг 1 из 1
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 12 }}>
          Что вам интересно?
        </h1>
        <p style={{ color: "var(--foreground-70)", fontSize: "var(--fs-body-lg)", marginTop: 12, maxWidth: 600 }}>
          Выберите направления — лента, чаты и объявления будут подбираться под них. Можно поменять позже в профиле.
        </p>

        <div className="mt-[32px] grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
          {INTERESTS.map((i) => {
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
                  {i.title}
                </div>
                <div style={{ color: "var(--foreground-70)", fontSize: "var(--fs-sm)", marginTop: 6 }}>{i.desc}</div>
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
            Выбрано:{" "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{selected.length}</span> из {INTERESTS.length}
          </div>
          <button
            onClick={finish}
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
          >
            Продолжить →
          </button>
        </div>
      </main>
    </div>
  );
}
