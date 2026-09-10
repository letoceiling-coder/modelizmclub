import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { variantUrl } from "@/lib/media/variants";
import type { Community } from "@/lib/mock";

/**
 * Список похожих сообществ.
 *
 * Один и тот же на карточке правой колонки и в окне из меню «Ещё»: на узком
 * экране правой колонки нет, а пункт меню там есть.
 */
export function SimilarCommunitiesList({ items }: { items: Community[] }) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <p className="py-[8px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {t("pages.communityDetail.similarEmpty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {items.map((c) => (
        <Link
          key={c.id}
          to="/communities/$id"
          params={{ id: c.id }}
          className="flex items-center gap-[10px] rounded-[10px] p-[6px] transition-colors hover:bg-[var(--background-surface)]"
        >
          <span
            className="grid h-[36px] w-[36px] shrink-0 place-items-center overflow-hidden rounded-[10px]"
            style={{ background: "var(--accent-soft)" }}
          >
            {c.avatarImage ? (
              <Img
                src={variantUrl(c.avatarImage, "thumb")}
                width={36}
                height={36}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Users size={16} style={{ color: "var(--accent)" }} />
            )}
          </span>
          <span className="min-w-0">
            <span
              className="block truncate text-[13px] font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {c.name}
            </span>
            <span className="block truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.shared.members", {
                count: c.members,
                formatted: c.members.toLocaleString("ru"),
              })}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
