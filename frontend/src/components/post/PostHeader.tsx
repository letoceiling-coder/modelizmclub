import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Post, User } from "@/lib/mock";
import { StatusBadge } from "@/components/StatusBadge";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { formatScheduledAt, defaultScheduleTimezone } from "@/lib/post-schedule";
import { formatDate } from "@/lib/format/date";
import { Img } from "@/components/ui/Img";

/** Avatar with initials fallback when the image fails to load or src is empty */
function AuthorAvatar({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?";
  if (!src || err) {
    return (
      <div
        className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
        style={{ background: "var(--accent)" }}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }
  return (
    <Img
      src={src}
      width={40}
      height={40}
      alt={name}
      className="h-[40px] w-[40px] shrink-0 rounded-full object-cover"
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
    <header className="flex items-center gap-[12px] px-[16px] pt-[16px]">
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
          {isScheduled && post.scheduledAt
            ? formatScheduledAt(post.scheduledAt, defaultScheduleTimezone())
            : formatDate(post.date, "relative")}
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
