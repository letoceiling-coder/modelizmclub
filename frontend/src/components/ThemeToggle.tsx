import { useTranslation } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle({ size = 40 }: { size?: number }) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={t("common.themeToggle")}
      title={t("common.themeToggle")}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        background: "var(--background-surface)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 200ms var(--ease-out-expo)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 90 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "inline-flex" }}
        >
          {isDark ? <Sun size={20} color="var(--foreground-70)" /> : <Moon size={20} color="var(--foreground-70)" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default ThemeToggle;
