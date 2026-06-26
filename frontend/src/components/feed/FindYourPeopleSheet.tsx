import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle, Users } from "lucide-react";
import * as Icons from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import type { Category } from "@/lib/types";
import { fetchPostCategories } from "@/lib/api/catalog";

function onlineFor(c: Category): number {
  const seed = c.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const base = Math.max(3, Math.round((c.members ?? 0) * 0.012));
  return base + (seed % 17);
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Icons.Hash;
  return <Icon className={className} />;
}

/**
 * Мобильная точка входа в «Найди своих».
 * На desktop правую колонку показывает RightCategories; этот компонент скрыт на xl+.
 */
export function FindYourPeopleSheet() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void fetchPostCategories().then(setCategories);
  }, []);

  return (
    <div className="xl:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-[12px] rounded-[14px] border px-[14px] py-[12px] text-left transition-colors hover:bg-[var(--background-surface)]"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
          >
            <span
              className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]"
              style={{ background: "var(--background-surface)", color: "var(--accent)" }}
            >
              <Users className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[14px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >{t("rightPanel.title")}</span>
              <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>{t("rightPanel.mobileSubtitle")}</span>
            </span>
            <ChevronDown
              className="h-[16px] w-[16px] -rotate-90 shrink-0"
              style={{ color: "var(--foreground-50)" }}
            />
          </button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="h-[88vh] rounded-t-[18px] p-0"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <SheetHeader className="border-b px-[16px] py-[14px] text-left" style={{ borderColor: "var(--border)" }}>
            <SheetTitle className="flex items-center gap-[8px] text-[15px]">
              <MessageCircle className="h-[16px] w-[16px]" style={{ color: "var(--accent)" }} />{t("rightPanel.title")}</SheetTitle>
            <SheetDescription className="text-[12px]">{t("rightPanel.subtitle")}</SheetDescription>
          </SheetHeader>

          <ul className="h-[calc(88vh-74px)] overflow-y-auto p-[8px]">
            {categories.map((c) => {
              const expanded = openId === c.id;
              const online = onlineFor(c);
              return (
                <li key={c.id}>
                  <div className="flex items-stretch">
                    <SheetClose asChild>
                      <Link
                        to="/categories/$id"
                        params={{ id: c.id }}
                        className="group flex flex-1 items-center gap-[12px] rounded-l-[12px] px-[12px] py-[10px] transition-colors hover:bg-[var(--background-surface)]"
                      >
                        <span
                          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]"
                          style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                        >
                          <CategoryIcon name={c.icon ?? "Hash"} className="h-[16px] w-[16px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-[14px] font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {c.name}
                          </span>
                          <span
                            className="mt-[2px] flex items-center gap-[6px] text-[11.5px]"
                            style={{ color: "var(--foreground-50)" }}
                          >
                            <span
                              className="inline-block h-[6px] w-[6px] rounded-full"
                              style={{ background: "#22c55e" }}
                            />
                            {t("common.onlineCount", { n: online })}
                          </span>
                        </span>
                      </Link>
                    </SheetClose>
                    {(c.subcategories?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenId(expanded ? null : c.id)}
                        aria-label={expanded ? t("rightPanel.collapseSubs") : t("rightPanel.expandSubs")}
                        aria-expanded={expanded}
                        className="grid w-[36px] place-items-center rounded-r-[12px] transition-colors hover:bg-[var(--background-surface)]"
                      >
                        <ChevronDown
                          className={`h-[16px] w-[16px] transition-transform ${expanded ? "rotate-180" : ""}`}
                          style={{ color: "var(--foreground-50)" }}
                        />
                      </button>
                    )}
                  </div>

                  {expanded && (c.subcategories?.length ?? 0) > 0 && (
                    <ul
                      className="mb-[6px] ml-[46px] mt-[2px] space-y-[1px] border-l pl-[12px]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {c.subcategories?.map((s) => (
                        <li key={s.id}>
                          <SheetClose asChild>
                            <Link
                              to="/categories/$id/$subId"
                              params={{ id: c.id, subId: s.id }}
                              className="block rounded-[8px] px-[10px] py-[7px] text-[13px] transition-colors hover:bg-[var(--background-surface)]"
                              style={{ color: "var(--foreground-70)" }}
                            >
                              {s.name}
                            </Link>
                          </SheetClose>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
