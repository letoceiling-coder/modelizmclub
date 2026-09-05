import { variantUrl } from "@/lib/media/variants";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Post, User } from "@/lib/mock";
import { StatusBadge } from "@/components/StatusBadge";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { formatScheduledAt, defaultScheduleTimezone } from "@/lib/post-schedule";
import { TimeAgo } from "@/components/TimeAgo";
import { Img } from "@/components/ui/Img";

/** Avatar with initials fallback when the image fails to load or src is empty */
function AuthorAvatar({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  // A 40px avatar was pulling the original upload — 412 KB of PNG for a
  // 40x40 box on production. thumb is 320px wide and about twenty times
  // lighter; media without variants still answers with the original.
  const avatarSrc = variantUrl(src, "thumb");
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?";
  // 36 на телефоне, 40 на широком экране: шапка держит 48 px в обоих случаях,
  // а на 375 лишние четыре пикселя аватара — это лишняя строка текста в ленте.
  if (!src || err) {
    return (
      <div
        className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full text-[13px] font-bold text-white md:h-[40px] md:w-[40px]"
        style={{ background: "var(--accent)" }}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }
  return (
    <Img
      src={avatarSrc}
      width={40}
      height={40}
      alt={name}
      className="h-[36px] w-[36px] shrink-0 rounded-full object-cover md:h-[40px] md:w-[40px]"
      onError={() => setErr(true)}
    />
  );
}

interface Props {
  author: User;
  authorHref: string;
  authorActionKey: string;
  post: Post;
  isScheduled: boolean;
  /** Category line after the date — feed and profile only. */
  showContext: boolean;
  /** Extra chips next to the name (channel: pinned, kind, moderation status). */
  badges?: ReactNode;
  /** The ⋯ menu, rendered on the right. */
  children?: ReactNode;
}

/** Avatar → profile, name → profile, date, optional context line, menu slot. */
export function PostHeader({
  author,
  authorHref,
  authorActionKey,
  post,
  isScheduled,
  showContext,
  badges,
  children,
}: Props) {
  const { t } = useTranslation();
  return (
    // 48 px на строку автора: аватар 40 плюс 8 сверху. Раньше было 16 сверху
    // при аватаре 40 — 56 px, и это повторялось у каждой карточки ленты.
    <header className="flex min-h-[48px] items-center gap-[10px] px-[12px] pt-[8px] md:gap-[12px] md:px-[16px]">
      {/* The ::after box lifts the 40px avatar to a 44px tap target without
          moving it or the name beside it. */}
      <GuestGuardLink
        actionKey={authorActionKey}
        to={authorHref}
        className='relative shrink-0 after:absolute after:-inset-[2px] after:rounded-full after:content-[""]'
      >
        <AuthorAvatar src={author.avatar} name={author.name} />
      </GuestGuardLink>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[8px]">
          <GuestGuardLink
            actionKey={authorActionKey}
            to={authorHref}
            className="truncate text-[14px] font-semibold hover:underline"
            style={{ color: "var(--foreground)" }}
          >
            {author.name}
          </GuestGuardLink>
          {post.status === "moderation" && (
            <StatusBadge variant="moderation">{t("components.postCard.moderation")}</StatusBadge>
          )}
          {isScheduled && (
            <StatusBadge variant="info">{t("components.postCard.scheduled")}</StatusBadge>
          )}
          {badges}
        </div>
        <div className="mt-[1px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {isScheduled && post.scheduledAt ? (
            formatScheduledAt(post.scheduledAt, defaultScheduleTimezone())
          ) : (
            <TimeAgo iso={post.date} />
          )}
          {showContext && post.category ? (
            <>
              {" · "}
              <span>{post.category}</span>
            </>
          ) : null}
        </div>
      </div>
      {children}
    </header>
  );
}
