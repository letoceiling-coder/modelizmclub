import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Icon as SlotIcon, CategoryIcon, IconBox } from "@/components/ui/Icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { onlineFor } from "@/lib/category-online";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";

/**
 * Мобильная точка входа в «Найди своих».
 * На desktop правую колонку показывает RightCategories; этот компонент скрыт на xl+.
 */
export function FindYourPeopleSheet() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const categories = usePostCategories();
  const { guardAction } = useGuestAccess();

  return (
    <div className="xl:hidden">
      <Sheet open={open} onOpenChange={(next) => {
        if (next) {
          guardAction("feed.find_people.open", () => setOpen(true));
          return;
        }
        setOpen(false);
      }}>
        <SheetTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              guardAction("feed.find_people.open", () => setOpen(true));
            }}
            className="flex w-full items-center gap-[12px] rounded-[var(--r-card)] border px-[14px] py-[12px] text-left transition-colors hover:bg-[var(--background-surface)]"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
          >
            <span
              className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]"
              style={{ background: "var(--background-surface)", color: "var(--accent)" }}
            >
              <SlotIcon slot="feed.find-people" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[14px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                {t("components.findYourPeopleSheet.title")}
              </span>
              <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>
                {t("components.findYourPeopleSheet.subtitle")}
              </span>
            </span>
            <ChevronDown
              className="h-[16px] w-[16px] -rotate-90 shrink-0"
              style={{ color: "var(--foreground-50)" }}
            />
          </button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="flex h-[88dvh] flex-col rounded-t-[18px] p-0 data-[state=open]:duration-300 data-[state=closed]:duration-200"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          {/* Grabber — signals the sheet is swipe-dismissable (native feel). */}
          <div className="flex shrink-0 justify-center pt-[8px] pb-[2px]">
            <span className="h-[4px] w-[36px] rounded-full" style={{ background: "var(--border)" }} />
          </div>
          <SheetHeader className="shrink-0 border-b px-[16px] pb-[14px] pt-[8px] text-left" style={{ borderColor: "var(--border)" }}>
            <SheetTitle className="flex items-center gap-[8px] text-[15px]">
              <MessageCircle className="h-[16px] w-[16px]" style={{ color: "var(--accent)" }} />
              {t("components.findYourPeopleSheet.title")}
            </SheetTitle>
            <SheetDescription className="text-[12px]">
              {t("components.findYourPeopleSheet.chatHint")}
            </SheetDescription>
          </SheetHeader>

          <ul className="min-h-0 flex-1 overflow-y-auto p-[8px]">
            {categories.map((c) => {
              const expanded = openId === c.id;
              const online = onlineFor(c);
              return (
                <li key={c.id}>
                  <div className="flex items-stretch">
                    <SheetClose asChild>
                      <GuestGuardLink
                        actionKey="feed.find_people.category"
                        to={`/categories/${c.id}`}
                        className="group flex flex-1 items-center gap-[12px] rounded-l-[12px] px-[12px] py-[10px] transition-colors hover:bg-[var(--background-surface)]"
                      >
                        <IconBox size="md" variant="surface">
                          <CategoryIcon categoryId={c.id} name={c.icon} iconImageUrl={c.iconImageUrl} fill />
                        </IconBox>
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
                            {t("components.findYourPeopleSheet.onlineCount", { count: online })}
                          </span>
                        </span>
                      </GuestGuardLink>
                    </SheetClose>
                    {c.subcategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenId(expanded ? null : c.id)}
                        aria-label={expanded ? t("components.findYourPeopleSheet.collapseSubcategories") : t("components.findYourPeopleSheet.expandSubcategories")}
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

                  {expanded && c.subcategories.length > 0 && (
                    <ul
                      className="mb-[6px] ml-[46px] mt-[2px] space-y-[1px] border-l pl-[12px]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {c.subcategories.map((s) => (
                        <li key={s.id}>
                          <SheetClose asChild>
                            <GuestGuardLink
                              actionKey="feed.find_people.category"
                              to={`/categories/${c.id}/${s.id}`}
                              className="block rounded-[8px] px-[10px] py-[7px] text-[13px] transition-colors hover:bg-[var(--background-surface)]"
                              style={{ color: "var(--foreground-70)" }}
                            >
                              {s.name}
                            </GuestGuardLink>
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
