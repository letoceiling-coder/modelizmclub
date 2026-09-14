import { m, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle({
  size = 40,
  alwaysVisible = false,
}: {
  size?: number;
  alwaysVisible?: boolean;
}) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={t("components.themeToggle.aria")}
      title={t("components.themeToggle.aria")}
      // Theme switching is desktop-only by default — hidden below lg across
      // most surfaces (auth, onboarding, admin). Callers that need it on
      // mobile too (landing footer, landing burger menu) pass alwaysVisible.
      className={alwaysVisible ? "hit-target inline-flex" : "hit-target hidden lg:inline-flex"}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        background: "var(--background-surface)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 200ms var(--ease-out-expo)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 90 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "inline-flex" }}
        >
          {/*
            Обе иконки в разметке, видна одна — по классу `dark` на <html>.
            Выбирать иконку по `theme` нельзя: сервер темы не знает и считает
            её тёмной, браузер со светлой темой рисовал другую иконку, и
            React падал с #418 на лендинге (D8). Класс `dark` скрипт из
            __root ставит до первой отрисовки, так что мигания нет.
          */}
          <Sun size={20} color="var(--foreground-70)" className="hidden dark:block" />
          <Moon size={20} color="var(--foreground-70)" className="block dark:hidden" />
        </m.span>
      </AnimatePresence>
    </button>
  );
}

export default ThemeToggle;
