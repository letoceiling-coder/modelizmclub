import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";

import { setLocale, type Locale } from "@/lib/i18n";

type Lang = Locale;

export const LANGS: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: "ru", label: "Русский", native: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "zh", label: "中文", native: "中文", flag: "🇨🇳" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const lang = (i18n.language as Lang) || "ru";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: Lang) => {
    setLocale(code);
    setOpen(false);
    const name = LANGS.find((l) => l.code === code)?.native ?? code;
    toast.success(name, {
      id: "lang-switch",
      duration: 1800,
      closeButton: false,
      className: "lang-switch-toast",
    });
  };

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-[40px] items-center gap-[6px] rounded-full px-[10px] transition-colors hover:bg-[color:var(--background-surface-hover)]"
        style={{ color: "var(--foreground-70)" }}
        aria-label={t("lang.title")}
        title={`${t("lang.title")}: ${current.native}`}
      >
        <Languages size={18} />
        <span className="text-[12px] font-semibold uppercase" style={{ color: "var(--foreground-60)" }}>
          {current.code}
        </span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-[6px] min-w-[180px] overflow-hidden rounded-[12px] py-[6px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-modal)",
          }}
          role="menu"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover)]"
              style={{ color: "var(--foreground)" }}
              role="menuitem"
            >
              <span style={{ fontSize: 16 }}>{l.flag}</span>
              <span className="flex-1 font-medium">{l.native}</span>
              {l.code === lang && <Check size={14} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
