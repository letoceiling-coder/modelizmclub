import { Link } from "@tanstack/react-router";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ИтогПриглашения } from "./InviteOutcome";
import { Users, Gift } from "lucide-react";
import { useReferral } from "@/lib/api/referral";
import { formatDate } from "@/lib/format/date";

export function InvitedFriendsSection() {
  const { data } = useReferral();
  const invited = data?.invited ?? [];
  const bonus = data?.bonus ?? 0;

  return (
    <section>
      <div className="flex items-center justify-between gap-[12px]">
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            color: "var(--foreground)",
          }}
        >
          Приглашённые друзья
        </h3>
        <span
          className="inline-flex items-center gap-[6px] font-semibold"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: "var(--r-pill)",
          }}
        >
          <Gift size={12} /> +{bonus}
        </span>
      </div>

      {invited.length === 0 ? (
        <div
          className="mt-[12px] flex flex-col items-center justify-center text-center"
          style={{
            padding: "32px 16px",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            color: "var(--foreground-50)",
          }}
        >
          <Users size={28} style={{ color: "var(--foreground-30)" }} />
          <p className="mt-[10px] text-[13px]">Вы пока никого не пригласили</p>
          <Link
            to="/referral"
            className="mt-[14px] inline-flex items-center gap-[6px] font-semibold"
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 10,
              background: "var(--accent-fill)",
              color: "white",
              fontSize: 13,
            }}
          >
            Получить ссылку
          </Link>
        </div>
      ) : (
        <ul className="mt-[12px] space-y-[8px]">
          {invited.map((inv) => {
            const u = inv.user;
            const to = u.slug ?? u.uuid;
            return (
              <li key={u.uuid}>
                <Link
                  to="/user/$id"
                  params={{ id: to }}
                  className="flex items-center gap-[12px] p-[12px] transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background: "var(--background)",
                  }}
                >
                  {/*
                    Аватар — общий `UserAvatar`, а не свой тег картинки.

                    Свой здесь был сломан: атрибуты вёрстки (`width`,
                    `height`, `loading`, `decoding`) оказались ВНУТРИ
                    шаблонной строки адреса, после `seed=`. То есть у
                    человека без фотографии адрес картинки содержал
                    переносы строк и фигурные скобки — браузер показывал
                    значок битого изображения, — а сам тег оставался без
                    размеров, то есть без резерва места.

                    Чинить адрес незачем: общий аватар рисует инициалы,
                    когда фотографии нет или она не загрузилась, и не ходит
                    за заглушкой к чужому серверу. `profileId` не передаём
                    намеренно — аватар уже внутри ссылки.
                  */}
                  <UserAvatar src={u.avatar} name={u.displayName} size={40} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate font-semibold"
                      style={{ fontSize: 14, color: "var(--foreground)" }}
                    >
                      {u.displayName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--foreground-50)" }}>
                      Присоединился {inv.joinedAt ? formatDate(inv.joinedAt, "relative") : ""}
                    </div>
                  </div>
                  <ИтогПриглашения inv={inv} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
