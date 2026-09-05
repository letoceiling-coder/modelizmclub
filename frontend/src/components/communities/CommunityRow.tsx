import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import type { Community } from "@/lib/mock";
import { joinCommunity } from "@/lib/api/communities";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { DeleteCommunityDialog } from "@/components/communities/DeleteCommunityDialog";

/** Роль зрителя: сервер отдаёт её тремя разными полями. */
export function viewerRole(c: Community): Community["role"] | undefined {
  if (c.role) return c.role;
  if (c.isOwner) return "owner";
  if (c.joined) return "member";
  return undefined;
}

/**
 * Сообщество строкой в 64 px: аватар, название, категория с числом
 * участников и одно действие справа.
 *
 * До 05.09 каждое сообщество было плиткой на 163–200 px с обложкой,
 * градиентом на её месте, описанием в две строки и счётчиками: на экран 1440
 * помещалось четыре штуки, и три четверти этой площади занимала картинка,
 * которая ничего не сообщает о сообществе. Список нужен, чтобы выбрать из
 * многих, а не чтобы рассмотреть одно.
 *
 * Вся строка — ссылка: невидимая ::after-коробка растянута по строке, а
 * кнопка справа лежит в потоке после неё и перехватывает нажатие сама, без
 * числовых z-index.
 */
export function CommunityRow({ c, onChanged }: { c: Community; onChanged?: () => void }) {
  const { t } = useTranslation();
  const { requirePremium } = useGuestAccess();
  const role = viewerRole(c);
  const [joined, setJoined] = useState(Boolean(c.joined) || role === "member");
  const [busy, setBusy] = useState(false);

  const meta = [
    c.category,
    c.members > 0
      ? t("pages.shared.members", { count: c.members.toLocaleString("ru") })
      : t("pages.shared.membersNew"),
  ]
    .filter(Boolean)
    .join(" · ");

  const join = () => {
    if (busy) return;
    requirePremium(() => {
      void (async () => {
        setBusy(true);
        try {
          const result = await joinCommunity(c.id);
          if (result.status === "pending") {
            toast.success(t("pages.communityDetail.requestPending"));
          } else {
            setJoined(true);
            onChanged?.();
          }
        } catch {
          toast.error(t("pages.shared.retry"));
        } finally {
          setBusy(false);
        }
      })();
    });
  };

  const badge =
    role === "owner"
      ? t("pages.shared.owner")
      : role === "moderator"
        ? t("pages.shared.moderator")
        : c.isOfficial
          ? t("pages.communities.badgeOfficial")
          : null;

  return (
    <div
      className="group relative flex h-[64px] items-center gap-[12px] rounded-[12px] px-[12px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ background: "var(--background-elevated)" }}
    >
      <UserAvatar src={c.avatarImage} name={c.name} size={48} />

      <Link
        to="/communities/$id"
        params={{ id: c.id }}
        className='min-w-0 flex-1 after:absolute after:inset-0 after:rounded-[12px] after:content-[""] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-[var(--accent)]'
      >
        <span className="flex min-w-0 items-center gap-[8px]">
          <span
            className="truncate text-[15px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {c.name}
          </span>
          {badge && (
            <span
              className="shrink-0 rounded-[var(--r-pill)] px-[6px] py-[1px] text-[11px] font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {badge}
            </span>
          )}
        </span>
        <span
          className="mt-[2px] block truncate text-[13px]"
          style={{ color: "var(--foreground-50)" }}
        >
          {meta}
        </span>
      </Link>

      {/* Действие лежит после ссылки в потоке: своё нажатие оно забирает себе,
          отдельного слоя для этого не нужно. */}
      <div className="relative flex shrink-0 items-center gap-[4px]">
        {role === "owner" && onChanged && (
          <DeleteCommunityDialog slug={c.id} name={c.name} onDeleted={onChanged} compact />
        )}
        {role === "owner" || role === "moderator" ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/communities/$id" params={{ id: c.id }}>
              {t("pages.communities.rowManage")}
            </Link>
          </Button>
        ) : joined ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/communities/$id" params={{ id: c.id }}>
              {t("pages.shared.goTo")}
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={join} disabled={busy}>
            {t("pages.communities.rowJoin")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Скелетон той же высоты, что и строка: список не дёргается при загрузке. */
export function CommunityRowSkeleton() {
  return (
    <div className="flex h-[64px] items-center gap-[12px] rounded-[12px] px-[12px] py-[8px]">
      <span
        className="h-[48px] w-[48px] shrink-0 animate-pulse rounded-full"
        style={{ background: "var(--background-surface)" }}
      />
      <span className="min-w-0 flex-1">
        <span
          className="block h-[15px] w-[40%] animate-pulse rounded-[4px]"
          style={{ background: "var(--background-surface)" }}
        />
        <span
          className="mt-[6px] block h-[13px] w-[60%] animate-pulse rounded-[4px]"
          style={{ background: "var(--background-surface)" }}
        />
      </span>
    </div>
  );
}
