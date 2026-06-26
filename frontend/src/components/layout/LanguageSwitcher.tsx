import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { toast } from "sonner";
import { LANG_META, useI18n, type AppLang } from "@/lib/i18n";

const LANGS: AppLang[] = ["ru", "en", "zh"];

type Props = {
  compact?: boolean;
  showFooter?: boolean;
};

export function LanguageSwitcher({ compact = false, showFooter = true }: Props) {
  const { lang, setLang, t } = useI18n();
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

  const pick = (code: AppLang) => {
    setLang(code);
    setOpen(false);
    const name = LANG_META[code].native;
    toast.success(t("common.languageChanged", { lang: name }));
  };

  const current = LANG_META[lang];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "inline-flex h-9 min-w-[36px] items-center justify-center gap-1 rounded-lg border px-2 transition-colors hover:bg-[color:var(--background-surface-hover)]"
            : "grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-muted"
        }
        style={{
          color: "var(--foreground-70)",
          borderColor: compact ? "var(--border)" : undefined,
          background: compact ? "var(--background-surface)" : undefined,
        }}
        aria-label={t("common.language")}
        title={`${t("common.language")}: ${current.native}`}
      >
        {compact ? (
          <>
            <span className="text-sm leading-none" aria-hidden>{current.flag}</span>
            <span className="text-[10px] font-bold uppercase leading-none">{lang}</span>
          </>
        ) : (
          <span className="relative inline-flex">
            <Languages size={16} />
            <span
              className="absolute -bottom-[6px] -right-[8px] grid h-[14px] min-w-[18px] place-items-center rounded-[4px] px-[3px] text-[9px] font-bold uppercase"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {lang}
            </span>
          </span>
        )}
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
          {LANGS.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => pick(code)}
              className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover)]"
              style={{ color: "var(--foreground)" }}
              role="menuitem"
            >
              <span style={{ fontSize: 16 }}>{LANG_META[code].flag}</span>
              <span className="flex-1 font-medium">{LANG_META[code].native}</span>
              {code === lang && <Check size={14} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
          {showFooter && (
            <div
              className="px-[14px] py-[8px] text-[11px]"
              style={{ borderTop: "1px solid var(--border)", color: "var(--foreground-50)" }}
            >
              {t("common.chatTranslateSoon")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
