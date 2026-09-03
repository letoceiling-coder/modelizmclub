# Гейт доступа (`frontend/src/lib/gate`)

Одна лестница уровней, одно окно за раз, возврат к действию после того, как
условие выполнено. Состояние пользователя — только из `useSession()`
(`['session']`): `{ user, phoneVerified, subscription: { active } }`.

## Уровни

| Level | кто | окно, если не хватает |
|---|---|---|
| `guest` | нет сессии | — |
| `registered` | вошёл, телефон не подтверждён | `auth` («Войдите или зарегистрируйтесь») |
| `verified` | телефон подтверждён (или не требуется — staff, demo) | `verify` («Подтвердите номер телефона») |
| `subscriber` | активная подписка или staff | `paywall` («Нужна подписка») |

`levelOf(session)` считает уровень; `firstFailingStep(have, need)` возвращает
**одно** окно — первую недостающую ступень. Гость никогда не увидит paywall.

`levelFromAccessTier(tier)` переводит runtime-настройку доступа из админки
(`guest | auth | subscription`) в Level: `auth → verified` — старый гвард
всегда требовал SMS сразу после входа, поведение сохранено.

## API

```ts
const { require, can, level, resolved } = useGate();
require("subscriber", () => like());          // выполнит или откроет окно
can("verified");                              // boolean без побочных эффектов

<Gated level="subscriber" action={doLike} entity={post} actionName="react">
  <button …/>                                 // onClick перехватывается
</Gated>
// entity.can.react === false → кнопка не рендерится (не окно, а отсутствие)

<GatedLink to="/messenger" level="verified">Написать</GatedLink>
// вместо навигации — окно; сама навигация становится intent и доиграет

// beforeLoad:
await routeGuard("verified", location);
// SSR → { ssrSkeleton: true }; клиент без прав → окно + redirect на /feed,
// после успеха — переход на исходный адрес.
```

Вне React — `gateRequire(level, action, { intent })` с той же семантикой.

## Intent и возобновление

`require` при отказе сохраняет `Intent` (`sessionStorage['gate.intent']`,
30 минут) и держит само действие в памяти. После успеха любого окна
`GateHost` вызывает `resumeIntent()`: перечитывает сессию, и либо повторяет
действие, либо открывает **следующую** недостающую ступень, либо выполняет
`navigate`-intent. При монтировании `GateHost` проверяет сохранённый intent —
так возврат с `/register` или из OAuth-редиректа доигрывает переход. Если
уровня по-прежнему не хватает, ничего не всплывает само: пользователь
повторит действие и получит нужное окно.

`/subscription?returnTo=` и `/register?returnTo=` принимают адрес возврата.

## Окна

`GateHost` смонтирован один раз в `__root.tsx`. На `< 768px` каждое окно —
`Sheet side="bottom"`, на десктопе — `Dialog`; кнопки `size="lg"` (44px).

- `AuthDialog` — вход по почте и паролю и OAuth **внутри окна**, без ухода на
  `/login`; «Зарегистрироваться» ведёт на `/register?returnTo=`.
- `VerifyPhoneDialog` — «Подтвердить номер» → номер → код, эндпоинты
  `POST /account/phone/send-code`, `POST /account/phone/verify`.
- `PaywallDialog` — `navigate({ to: "/subscription", search: { returnTo } })`.

## Правила

1. Компонент никогда не решает «показать ли paywall» сам — только `level`.
2. Один клик — максимум одно окно. Следующее откроется только после успеха.
3. Если сервер прислал `can` — верим ему: `false` скрывает контрол.
4. Старые механизмы (`lib/auth/*`, `components/access/*`, `lib/access/*`,
   `lib/feed-guest-access/*`) не трогаем до миграции W1-01; первый потребитель
   гейта — `components/PostCard.tsx` (лайк, сохранение, комментарий, репост).
