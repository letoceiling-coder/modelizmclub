import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { fetchAdminUserCard, type AdminUserCard as Карточка } from "@/lib/api/admin";
import { reportReadFailure } from "@/lib/errors/handle";
import { formatAbsoluteInZone } from "@/lib/format/date";

/**
 * Полная карточка пользователя — окном, а не переходом.
 *
 * До 27.09 глаз в списке вызывал `toast.info` с именем: действие выглядело
 * как «посмотреть», а смотреть было нечего. Ответ на вопрос «что за человек
 * и что мы потеряем, если удалим учётку» приходилось искать в базе.
 *
 * Окно, а не страница, нарочно: администратор остаётся на своём месте
 * списка, прокрутка не сбрасывается, и после действия видно ту же строку,
 * с которой он начал. Переход на отдельный адрес возвращал бы его наверх.
 */
export function AdminUserCardDialog({
  uuid,
  onClose,
  onChanged,
  actions,
}: {
  uuid: string | null;
  onClose: () => void;
  /** Что-то изменилось — список снаружи перечитывает свою строку. */
  onChanged?: () => void;
  /** Действия над учёткой; их держит список, чтобы не дублировать обработчики. */
  actions?: (card: Карточка) => React.ReactNode;
}) {
  const [card, setCard] = useState<Карточка | null>(null);
  const [грузится, setГрузится] = useState(false);
  const [отказ, setОтказ] = useState(false);

  useEffect(() => {
    if (!uuid) {
      setCard(null);
      setОтказ(false);
      return;
    }
    let живо = true;
    setГрузится(true);
    setОтказ(false);
    fetchAdminUserCard(uuid)
      .then((c) => живо && setCard(c))
      .catch((e) => {
        if (!живо) return;
        setОтказ(true);
        reportReadFailure(e, "карточка пользователя");
      })
      .finally(() => живо && setГрузится(false));
    return () => {
      живо = false;
    };
  }, [uuid]);

  return (
    <Dialog open={uuid !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{card?.displayName ?? "Карточка пользователя"}</DialogTitle>
        </DialogHeader>

        {грузится && !card ? (
          <div className="flex items-center gap-2 py-6" style={{ color: "var(--foreground-50)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[14px]">Собираю карточку…</span>
          </div>
        ) : отказ ? (
          <div className="py-6">
            <p className="text-[14px]" style={{ color: "var(--foreground-80)" }}>
              Не удалось загрузить карточку.
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                if (uuid)
                  void fetchAdminUserCard(uuid)
                    .then(setCard)
                    .catch(() => setОтказ(true));
              }}
            >
              Повторить
            </Button>
          </div>
        ) : card ? (
          <Содержимое card={card} actions={actions} onChanged={onChanged} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Содержимое({
  card,
  actions,
}: {
  card: Карточка;
  actions?: (card: Карточка) => React.ReactNode;
  onChanged?: () => void;
}) {
  return (
    <div className="space-y-5">
      <Шапка card={card} />
      <Поля card={card} />
      <Размещения card={card} />
      <Счётчики card={card} />
      <Пространства card={card} />
      {actions ? (
        <Раздел название="Действия">
          <div className="flex flex-wrap gap-2">{actions(card)}</div>
        </Раздел>
      ) : null}
      <Журнал card={card} />
    </div>
  );
}

function Шапка({ card }: { card: Карточка }) {
  return (
    <div className="flex items-start gap-3">
      {/* Через UserAvatar, а не <img>: он берёт вариант thumb и рисует
          инициалы, когда аватара нет. Второй такой же в проекте не нужен. */}
      <UserAvatar src={card.avatarUrl} name={card.displayName} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
            {card.displayName}
          </span>
          <StatusBadge
            variant={
              card.status === "active"
                ? "success"
                : card.status === "blocked"
                  ? "danger"
                  : "warning"
            }
          >
            {card.status === "active"
              ? "Активен"
              : card.status === "blocked"
                ? "Заблокирован"
                : "Ожидает"}
          </StatusBadge>
          <StatusBadge variant="default">{роль(card.role)}</StatusBadge>
        </div>
        {/*
          Ссылка на публичную страницу — то, чего в админке не было вовсе:
          посмотреть человека «как его видят» можно было только собрав адрес
          руками. Slug приходит из профиля; без него страницы нет.
        */}
        {card.slug ? (
          <Link
            to="/user/$id"
            params={{ id: card.slug }}
            target="_blank"
            className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium"
            style={{ color: "var(--accent)" }}
          >
            Открыть профиль пользователя
            <ExternalLink size={13} />
          </Link>
        ) : (
          <span className="mt-1 block text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Публичной страницы нет: у учётки не заполнен профиль.
          </span>
        )}
      </div>
    </div>
  );
}

function Поля({ card }: { card: Карточка }) {
  const подписка = card.subscription.isActive
    ? `активна${card.subscription.endsAt ? ` до ${дата(card.subscription.endsAt)}` : ""}`
    : card.subscription.status === "expired"
      ? "истекла"
      : "нет";

  return (
    <Раздел название="Учётная запись">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <Поле
          подпись="Почта"
          значение={card.email}
          пометка={card.emailVerified ? null : "не подтверждена"}
        />
        <Поле
          подпись="Телефон"
          значение={card.phone ?? "не указан"}
          пометка={card.phone && !card.phoneVerified ? "не подтверждён" : null}
        />
        <Поле подпись="Город" значение={card.city ?? "не указан"} />
        <Поле подпись="Регистрация" значение={дата(card.registeredAt)} />
        <Поле подпись="Последняя активность" значение={дата(card.lastSeenAt)} />
        <Поле подпись="Подписка" значение={подписка} />
        {card.wallet ? (
          <Поле
            подпись="Баланс кошелька"
            значение={`${рубли(card.wallet.balanceKopecks)} ₽`}
            пометка={
              card.wallet.heldKopecks > 0 ? `в залоге ${рубли(card.wallet.heldKopecks)} ₽` : null
            }
          />
        ) : null}
        {/*
          Баллы рядом с кошельком и по тому же правилу видимости: это
          такая же величина «сколько у человека на счету», только она не
          выводится деньгами. Ноль показывается нулём — раньше блока не
          было вовсе, потому что баллов не существовало.
        */}
        {card.bonus ? (
          <Поле
            подпись="Бонусные баллы"
            значение={String(card.bonus.balance)}
            пометка={
              card.bonus.earnedByReferrals > 0
                ? `из них за приглашения ${card.bonus.earnedByReferrals}`
                : "не выводятся деньгами"
            }
          />
        ) : null}
      </dl>
    </Раздел>
  );
}

/**
 * Три способа разместить объявление без оплаты — рядом и с подписями.
 *
 * Прежнее название «кредиты размещения» не говорило ни что это, ни чем
 * отличается от квот, и в списке стояло одним числом без объяснения.
 * Здесь все три величины вместе: запас штук, личная льгота и освобождение
 * от подписки. Разбор — в `docs/known-issues.md`.
 */
function Размещения({ card }: { card: Карточка }) {
  const { placements: p } = card;

  return (
    <Раздел название="Размещение объявлений">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <Поле
          подпись="Размещений в запасе"
          значение={String(p.stock)}
          пометка="штука на объявление, не сгорает"
        />
        <Поле
          подпись="Личная льгота"
          значение={
            p.personalQuotaUnlimited
              ? "без предела"
              : p.personalQuotaRemaining === null
                ? "—"
                : `осталось ${p.personalQuotaRemaining}`
          }
        />
        {p.subscriptionExempt ? <Поле подпись="Подписка" значение="не требуется — льгота" /> : null}
      </dl>
      {card.placementGrants && card.placementGrants.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {card.placementGrants.slice(0, 5).map((g, i) => (
            <li key={i} className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {g.amount > 0 ? "+" : ""}
              {g.amount} · {подписьНачисления(g.type)}
              {g.description ? ` · ${g.description}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </Раздел>
  );
}

function Счётчики({ card }: { card: Карточка }) {
  const { counts: c } = card;

  return (
    <Раздел название="Что создано">
      <div className="flex flex-wrap gap-4">
        <Число подпись="Объявления" значение={c.listings} />
        <Число подпись="Публикации" значение={c.posts} />
        <Число подпись="Комментарии" значение={c.comments} />
        <Число подпись="Сделки" значение={c.safeDeals} />
      </div>
    </Раздел>
  );
}

function Пространства({ card }: { card: Карточка }) {
  const { spaces: s } = card;
  const пусто =
    s.communitiesCreated.length === 0 &&
    s.channelsOwned.length === 0 &&
    s.communitiesJoined === 0 &&
    s.channelsSubscribed === 0;

  if (пусто) {
    return (
      <Раздел название="Сообщества и каналы">
        <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
          Ничего не создал и никуда не вступал.
        </p>
      </Раздел>
    );
  }

  return (
    <Раздел название="Сообщества и каналы">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <Поле
          подпись="Создал сообществ"
          значение={s.communitiesCreated.length === 0 ? "нет" : s.communitiesCreated.join(", ")}
        />
        <Поле подпись="Состоит в сообществах" значение={String(s.communitiesJoined)} />
        <Поле
          подпись="Свои каналы"
          значение={s.channelsOwned.length === 0 ? "нет" : s.channelsOwned.join(", ")}
        />
        <Поле подпись="Подписан на каналы" значение={String(s.channelsSubscribed)} />
      </dl>
    </Раздел>
  );
}

/**
 * Последние действия над учёткой — из журнала изменений.
 *
 * Именно над ней, а не ею совершённые: карточку открывают, чтобы понять,
 * что с человеком делали. 24.09 три роли, выданные «на минуту посмотреть»,
 * нашлись только разбором аудита в базе — здесь это видно сразу.
 */
function Журнал({ card }: { card: Карточка }) {
  if (card.audit.length === 0) {
    return (
      <Раздел название="Последние действия">
        <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
          С учётной записью ничего не делали.
        </p>
      </Раздел>
    );
  }

  return (
    <Раздел название="Последние действия">
      <ul className="space-y-2">
        {card.audit.map((a, i) => (
          <li key={i} className="text-[13px]">
            <div style={{ color: "var(--foreground)" }}>
              {подписьДействия(a.action)}
              {a.by ? ` · ${a.by}` : ""}
            </div>
            <div style={{ color: "var(--foreground-50)" }}>
              {дата(a.createdAt)}
              {изменение(a.oldValues, a.newValues)}
            </div>
          </li>
        ))}
      </ul>
    </Раздел>
  );
}

function Раздел({ название, children }: { название: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        className="mb-2 text-[12px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--foreground-50)" }}
      >
        {название}
      </h3>
      {children}
    </section>
  );
}

function Поле({
  подпись,
  значение,
  пометка,
}: {
  подпись: string;
  значение: string;
  пометка?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
        {подпись}
      </dt>
      <dd className="break-words text-[14px]" style={{ color: "var(--foreground)" }}>
        {значение}
        {пометка ? (
          <span className="ml-1 text-[12px]" style={{ color: "var(--warning, #b8860b)" }}>
            · {пометка}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Число({ подпись, значение }: { подпись: string; значение: number }) {
  return (
    <div>
      <div className="text-[20px] font-semibold" style={{ color: "var(--foreground)" }}>
        {значение}
      </div>
      <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
        {подпись}
      </div>
    </div>
  );
}

function роль(r: Карточка["role"]): string {
  return r === "owner"
    ? "Владелец"
    : r === "moderator"
      ? "Модератор"
      : r === "category_admin"
        ? "Админ направления"
        : "Пользователь";
}

function подписьДействия(action: string): string {
  const словарь: Record<string, string> = {
    "admin.users.update": "Правка учётной записи",
    "admin.users.listing_credits": "Изменён запас размещений",
    "admin.users.subscription": "Изменена подписка",
    "admin.users.delete": "Удаление учётной записи",
  };

  return словарь[action] ?? action;
}

function подписьНачисления(type: string): string {
  return type === "referral"
    ? "за приглашённого друга"
    : type === "admin_grant"
      ? "начислено из админки"
      : type;
}

/** Что именно поменялось — короткой строкой, только по изменившимся полям. */
function изменение(
  было: Record<string, unknown> | null,
  стало: Record<string, unknown> | null,
): string {
  if (!стало) return "";
  const части: string[] = [];
  for (const [ключ, значение] of Object.entries(стало)) {
    const прежнее = было?.[ключ];
    if (прежнее === значение) continue;
    части.push(`${ключ}: ${String(прежнее ?? "—")} → ${String(значение ?? "—")}`);
  }

  return части.length > 0 ? ` · ${части.join(", ")}` : "";
}

/**
 * Дата — абсолютная и в московском поясе.
 *
 * Не `toLocaleString`: сервер в UTC, человек в Москве, и разбор этого уже
 * записан в CLAUDE.md. `formatAbsoluteInZone` даёт одно и то же на сервере
 * и в браузере.
 */
function дата(iso: string | null): string {
  if (!iso) return "—";

  return formatAbsoluteInZone(iso);
}

function рубли(копейки: number): string {
  return (копейки / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 });
}
