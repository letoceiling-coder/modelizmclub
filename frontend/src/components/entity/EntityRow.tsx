import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Props {
  /** Куда ведёт строка целиком. */
  to: string;
  params: Record<string, string>;
  avatarUrl?: string | null;
  name: string;
  /** Бейджи после названия: роль, «официальное». */
  badges?: ReactNode;
  /** Вторая строка: категория, счётчики — одной строкой с многоточием. */
  meta: string;
  /** Действие справа: кнопка, меню или и то и другое. */
  action?: ReactNode;
}

/**
 * Сущность строкой в 64 px — сообщество, канал.
 *
 * Плитка с обложкой в списке показывает картинку, а список нужен, чтобы
 * выбрать из многих: на 1440 в плитках помещалось четыре штуки, строк
 * помещается восемь.
 *
 * Вся строка — ссылка: невидимая ::after-коробка растянута по строке. Кнопка
 * справа лежит в потоке после неё и забирает нажатие себе, поэтому числовых
 * z-index здесь не нужно.
 */
export function EntityRow({ to, params, avatarUrl, name, badges, meta, action }: Props) {
  return (
    <div
      className="group relative flex h-[64px] items-center gap-[12px] rounded-[12px] px-[12px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ background: "var(--background-elevated)" }}
    >
      <UserAvatar src={avatarUrl} name={name} size={48} />

      <Link
        to={to}
        params={params}
        className='min-w-0 flex-1 after:absolute after:inset-0 after:rounded-[12px] after:content-[""] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-[var(--accent)]'
      >
        <span className="flex min-w-0 items-center gap-[8px]">
          <span
            className="truncate text-[15px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {name}
          </span>
          {badges}
        </span>
        <span
          className="mt-[2px] block truncate text-[13px]"
          style={{ color: "var(--foreground-50)" }}
        >
          {meta}
        </span>
      </Link>

      {action && <div className="relative flex shrink-0 items-center gap-[4px]">{action}</div>}
    </div>
  );
}

/** Бейдж после названия — общий вид для роли и «официального». */
export function EntityRowBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="shrink-0 rounded-[var(--r-pill)] px-[6px] py-[1px] text-[11px] font-semibold"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
    >
      {children}
    </span>
  );
}

/** Скелетон той же высоты: список не дёргается при загрузке. */
export function EntityRowSkeleton() {
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
