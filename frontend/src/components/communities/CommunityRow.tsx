import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import type { Community } from "@/lib/mock";
import { joinCommunity } from "@/lib/api/communities";
import { Button } from "@/components/ui/button";
import { EntityRow, EntityRowBadge } from "@/components/entity/EntityRow";
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
    <EntityRow
      to="/communities/$id"
      params={{ id: c.id }}
      avatarUrl={c.avatarImage}
      name={c.name}
      badges={badge ? <EntityRowBadge>{badge}</EntityRowBadge> : undefined}
      meta={meta}
      action={
        <>
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
        </>
      }
    />
  );
}

export { EntityRowSkeleton as CommunityRowSkeleton } from "@/components/entity/EntityRow";
