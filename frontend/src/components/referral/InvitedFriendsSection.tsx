import { Link } from "@tanstack/react-router";
import { Users, Gift } from "lucide-react";
import { userById } from "@/lib/mock";
import {
  getInvitedFriends,
  getReferralBonus,
  REFERRAL_MAX_BONUS,
} from "@/lib/referral";

export function InvitedFriendsSection() {
  const invited = getInvitedFriends();
  const bonus = getReferralBonus();

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
            borderRadius: 999,
          }}
        >
          <Gift size={12} /> +{bonus} / {REFERRAL_MAX_BONUS}
        </span>
      </div>

      {invited.length === 0 ? (
        <div
          className="mt-[12px] flex flex-col items-center justify-center text-center"
          style={{
            padding: "32px 16px",
            border: "1px dashed var(--border)",
            borderRadius: 14,
            color: "var(--foreground-50)",
          }}
        >
          <Users size={28} style={{ color: "var(--foreground-30)" }} />
          <p className="mt-[10px] text-[13px]">Вы пока никого не пригласили</p>
          <Link
            to="/subscription"
            className="mt-[14px] inline-flex items-center gap-[6px] font-semibold"
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 10,
              background: "var(--accent)",
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
            const u = userById(inv.userId);
            return (
              <li key={inv.userId}>
                <Link
                  to="/user/$id"
                  params={{ id: u.id }}
                  className="flex items-center gap-[12px] p-[12px] transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background: "var(--background)",
                  }}
                >
                  <img
                    src={u.avatar}
                    alt=""
                    className="h-[40px] w-[40px] rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate font-semibold"
                      style={{ fontSize: 14, color: "var(--foreground)" }}
                    >
                      {u.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--foreground-50)" }}>
                      Присоединился {inv.joinedAt}
                    </div>
                  </div>
                  <span
                    className="shrink-0 font-semibold"
                    style={{
                      fontSize: 12,
                      color: "var(--success)",
                      background: "var(--success-soft)",
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    +1
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
