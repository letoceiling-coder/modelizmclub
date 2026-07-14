# Композер ленты — меню «Создать» с выбором типа/источника — Design

## Контекст

Модалка «Фото публикации» в композере ленты сейчас открывается сразу на
шаг загрузки фото — но по описанию пользователя загрузка «не работает».

### Ключевая находка при исследовании кода

Загрузка **уже реально почищена сегодня** в этой же сессии, коммитом
`d6b7469` (`fix(feed): post composer never actually uploaded photos or
created a post`, уже запушен и задеплоен, входит в текущий HEAD
`0483ca4`): старый `addPost` фабриковал фейковый `Post` на клиенте
(`blob:`-URL как фото) и пушил его в локальный стейт — пост «публиковался»
визуально, но не переживал reload и не был виден другим пользователям.
Заменено на реальный `uploadMedia(file,"post")` → `createPost()` →
`publishPost()` (тот же паттерн, что уже работает в объявлениях/каналах).
Скриншот пользователя, скорее всего, снят до этого фикса.

Единственное, что реально осталось сломанным — **регрессия из того же
коммита**: раньше клик по иконке камеры сразу открывал системный
файл-пикер (`useEffect` на `intent==="photo"` с `fileRef.current?.click()`
через 150мс). Этот эффект был удалён вместе со старым фейковым кодом и не
восстановлен — сегодня клик по камере просто открывает модалку на пустом
шаге загрузки.

### Проверено дополнительно (по прямому запросу)

- **Владение каналом** (`owner_id === user.id`) — не клиентская проверка,
  а серверная: `ChannelResource.php` отдаёт `is_owner`, фронт читает как
  `Channel.isOwner` (`src/lib/channels.ts`). Публикация от канала —
  жёсткий 403 на бэке, если не владелец.
- **Канал → лента** — реальный механизм (коммит `640ca2a`, тоже сегодня):
  `ChannelController::storePost()` → `duplicateToFeed()` создаёт ОБЫЧНЫЙ
  `Post` через тот же `PostService::create/publish`, что и любой
  пользовательский пост, под авто-создаваемой категорией «Каналы».
  Никакого отдельного фронтенд-вызова «продублировать в ленту» не нужно —
  это чисто серверный побочный эффект уже отработавшего `POST
  /channels/{slug}/posts`.
- **Публикация участниками сообществ** — **не существует**. Кнопка
  «Предложить проект» / `SubmitPostSheet.tsx` — demo-only UI-муляж:
  гейтится полем `Community.allowSubmitPost`, которое реальный API-маппер
  никогда не читает/не пишет (всегда `undefined` на бою → кнопка нигде не
  рендерится вне demo), а `submit()` — чистый `setTimeout` с фейковым
  тостом, без единого запроса к API. Бэкенд-эндпоинта тоже нет. По
  решению пользователя — сообщества в новый флоу не входят.
- Ни у `Post`, ни у `ChannelPost` **нет** поля-дискриминатора
  «опубликовано как канал/профиль» — канальный пост в ленте неотличим от
  обычного, кроме категории «Каналы». Эта спека не меняет модель данных.

## Решения, зафиксированные при брейншторме

1. **Тип поста** («Пост» / «Видео») — это ОБЫЧНЫЙ пост с видео вместо
   фото, не отдельная фича. Переиспользует тот же
   `uploadMedia→createPost→publishPost` конвейер, просто с media purpose
   `"post_video"` вместо `"post"` (purpose уже существует в `MediaPurpose`,
   сейчас нигде для постов не используется).
2. **Интерактивная структура — вариант A**: на десктопе — вложенное меню
   (Radix `DropdownMenuSub`, уже есть в `@/components/ui/dropdown-menu`,
   новых примитивов не требуется): «Создать» → [Пост | Видео] → (только
   если есть свой канал) [От своего профиля | От канала «Имя»]. На
   мобильном — плоский список без вложенности (`vaul` `Drawer`, как
   `MoreMenu`): 2 пункта без канала, до 4 комбинаций с каналом.
3. **Источник «канал»** переиспользует уже рабочий `createChannelPost` +
   серверное дублирование в ленту — фронтенду не нужно ничего
   оркестровать самому для дублирования.
4. **Регрессия с камерой чинится в этом же заходе**: авто-открытие
   системного файл-пикера при монтировании формы (не по клику камеры,
   которой в новом флоу больше нет как отдельного элемента, — по факту
   монтирования формы после выбора типа в меню).
5. **Сообщества** — не участвуют в этом флоу (см. находку выше).
6. **Owner-каналы**: выделенного `GET /channels/mine` нет. Используем
   существующий `useChannels()` (`fetchChannels()` возвращает весь
   список с серверным `isOwner` на канал) и фильтруем клиентски —
   работает уже сегодня без бэкенд-изменений, задокументируем как
   backend-need оптимизацию (не блокирует эту фичу).

## Архитектура

### A. `src/lib/hooks/useHoverDropdown.ts` (новый файл)

Извлечение hover-логики из `UserMenu.tsx` (сегодняшний фикс: `modal=false`
+ `isPhantomHoverEvent` + `CLOSE_DELAY_MS`), чтобы не дублировать в новом
меню «Создать». Сигнатура:

```ts
export function useHoverDropdown(): {
  open: boolean;
  setOpen: (v: boolean) => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
  onWrapperMouseEnter: (e: React.MouseEvent) => void;
  onWrapperMouseLeave: (e: React.MouseEvent) => void;
  onContentMouseEnter: (e: React.MouseEvent) => void;
};
```

`UserMenu.tsx` переписывается на использование этого хука (без изменения
видимого поведения — чистый рефактор, dropdown должен вести себя
идентично: hover-open/close, Escape, click-outside, без флика при
стационарном курсоре — как уже живо проверено сегодня).

### B. `src/components/feed/CreatePostMenu.tsx` (новый файл, заменяет `CreatePostTrigger.tsx`)

```ts
export type ComposerKind = "photo" | "video";
export type ComposerSource = "profile" | "channel";
export interface ComposerSelection { kind: ComposerKind; source: ComposerSource; }

interface Props {
  onSelect: (sel: ComposerSelection) => void;
}
```

Внутри: `useChannels()`, `myChannel = channels.find(c => c.isOwner)`.

**Десктоп** (`lg:block`): `useHoverDropdown()` + Radix `DropdownMenu
modal={false}` (тот же паттерн, что `UserMenu`). Кнопка «Создать» —
минималистичная (иконка `Plus` + текст, `h-40px`, акцентный контур,
не полноширинная плашка, как сейчас). Контент:

```tsx
<DropdownMenuContent>
  {(["photo","video"] as const).map((kind) => (
    myChannel ? (
      <DropdownMenuSub key={kind}>
        <DropdownMenuSubTrigger>{kind === "photo" ? "Пост" : "Видео"}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onSelect={() => onSelect({ kind, source: "profile" })}>От своего профиля</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSelect({ kind, source: "channel" })}>От канала «{myChannel.name}»</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem key={kind} onSelect={() => onSelect({ kind, source: "profile" })}>
        {kind === "photo" ? "Пост" : "Видео"}
      </DropdownMenuItem>
    )
  ))}
</DropdownMenuContent>
```

**Мобильный** (`lg:hidden`): `vaul` `Drawer` (как `MoreMenu`). Плоский
список пунктов — без канала: «Пост», «Видео»; с каналом: «Пост от
профиля», «Пост от канала «Имя»», «Видео от профиля», «Видео от канала
«Имя»». Тап по пункту вызывает `onSelect` и закрывает `Drawer`.

`feed.tsx` заменяет текущий рендер `<CreatePostTrigger onOpen={...}/>` на
`<CreatePostMenu onSelect={(sel) => { setComposerSelection(sel); setComposerOpen(true); }} />`,
и передаёт `composerSelection` в `CreatePostModal`/`CreatePostForm` вместо
удаляемого `intent`.

### C. `src/components/CreatePostForm.tsx` — схлопывание в один шаг

Убирается `Step = "photos" | "details"` и весь связанный UI-переключатель
(`ArrowLeft`/`X` в хэдере, кнопка «Далее»/«Далее без фото»). Новый пропс:

```ts
interface Props {
  onCreate?: (p: Post) => void;
  onClose?: () => void;
  selection: ComposerSelection;   // { kind, source } — заменяет старый intent
  myChannel?: Channel;             // передаётся, только если selection.source === "channel"
}
```

Один экран сверху вниз:
1. Аватар + `title`-инпут (**только** если `selection.source === "profile"`
   — у канального поста нет заголовка, ровно как в существующем
   `Composer` внутри `channel.$id.tsx`).
2. `textarea` (плейсхолдер меняется по `source`, как в текущем канальном
   `Composer`: `Текст ${kind}а для подписчиков…` для канала, текущий
   плейсхолдер для профиля).
3. Если `source === "profile"`: два `ChipSelect` (Направление/Подкатегория,
   как сейчас). Если `source === "channel"`: селектор `PostKind`
   (новость/обзор/анонс/спецпредложение — тот же набор кнопок, что в
   `channel.$id.tsx`'s `Composer`, `POST_KIND_LABEL`/`POST_KIND_ICON`).
4. Медиа-виджет по `selection.kind`: `kind==="photo"` → `ImageUploadGrid`
   (как сейчас); `kind==="video"` → `VideoUploadField accept="video/*"`
   (тот же компонент, что уже используется в канальном `Composer` и
   Reviews).

`publish()` разветвляется по `source`:

```ts
if (selection.source === "profile") {
  const mediaIds = await uploadAll(selection.kind === "photo" ? photoFiles : videoFile ? [videoFile] : []);
  let post = await createPost({ title: title.trim(), body: text.trim(), categoryId: Number(cat.id), mediaIds });
  if (!isDemoMode()) post = await publishPost(post.id);
  onCreate?.(post);
  toast.success("Публикация отправлена на модерацию");
} else {
  const mediaIds = await uploadAll(selection.kind === "photo" ? photoFiles : videoFile ? [videoFile] : []);
  await createChannelPost({ channelSlug: myChannel!.slug, text: text.trim(), kind: channelKind, mediaIds });
  toast.success("Пост опубликован в канал");
  // No onCreate call here — createChannelPost only returns a ChannelPost
  // (channel-scoped view), not the duplicated Post the backend created
  // server-side. feed.tsx's onCreate/addPost stays Post-only, unchanged
  // from today; there is nothing to locally fabricate or prepend here —
  // the real duplicated Post will appear on the next GET /feed, exactly
  // like any other post. This is the same discipline that fixed today's
  // addPost bug: never construct a local stand-in to represent success.
}
onClose?.();
```

`onCreate`'s signature stays exactly `(p: Post) => void`, unchanged from
today — it is simply not invoked on the channel branch. This avoids
inventing a `Post | ChannelPost` union that `feed.tsx` would need to
runtime-check.

`uploadAll` is the same loop `for (file of files) uploadMedia(file,
purpose)` that already exists in both `CreatePostForm` and the channel
`Composer` (purpose `"post"` for photo, `"post_video"` for video —
consistent with the media purpose already declared in `media.ts`).

Header title is static: **«Новый пост»** for both sources (no
per-channel title variant — keeps the header logic identical to today's,
and the channel context is already visible via the source-selection step
the user just came from).

### D. Авто-открытие файл-пикера (фикс регрессии камеры)

Новый опциональный пропс `autoOpen?: boolean` на обоих виджетах:

**`ImageUploadGrid`** (`src/components/ads/wizard/ImageUploadGrid.tsx`):
добавляется `ref` на `<input type="file">` +:
```ts
useEffect(() => {
  if (!autoOpen) return;
  const t = setTimeout(() => inputRef.current?.click(), 150);
  return () => clearTimeout(t);
}, []); // mount-only, как было в старом intent==="photo" эффекте
```

**`VideoUploadField`** (`src/components/reviews/VideoUploadField.tsx`):
аналогично, `ref` на свой `<input type="file">` + тот же mount-only
эффект по `autoOpen`.

Оба пропса опциональны (без указания — `undefined`, эффект не
срабатывает), поэтому существующие вызовы в `ads.new.tsx` и канальном
`Composer` не меняют поведение. `CreatePostForm` передаёт `autoOpen`
всегда `true` для своего виджета (т.к. тип уже выбран в меню «Создать» —
пользователь пришёл в форму именно за загрузкой конкретного медиа).

## Данные / типы

- **Не добавляются** новые поля ни в `Post`, ни в `ChannelPost` — канальный
  пост остаётся обычным `Post` в ленте (категория «Каналы»), в точности
  как сегодня.
- `CreatePostForm`'s `onCreate?: (p: Post) => void` prop is unchanged —
  it's only invoked on the `source==="profile"` branch with the real
  `Post` the backend returned. The `source==="channel"` branch calls
  `createChannelPost()`, shows its own success toast, and closes the
  modal directly — it never calls `onCreate` and never fabricates a
  local `Post`/`ChannelPost` stand-in. The channel-duplicated `Post`
  shows up in the feed on its own via the next real `GET /feed`, exactly
  like today. This is the same discipline that fixed today's addPost
  bug: never construct a local placeholder to represent success.
- Владение каналом — `channels.find(c => c.isOwner)`, без новых
  бэкенд-вызовов. Backend-need (не блокирует): `GET /channels?mine=1`
  для эффективности при большом количестве каналов на сайте.
- `PostIntent` (старый тип в `CreatePostTrigger.tsx`) удаляется вместе с
  файлом; заменяется `ComposerSelection` в новом `CreatePostMenu.tsx`.

## Без дёргания layout / мобильная адаптация

- Десктопное меню — тот же проверенный сегодня паттерн (`useHoverDropdown`
  + `modal={false}`), никакого нового класса багов не вносится.
- Мобильный `Drawer` — уже существующий, живо проверенный паттерн
  (`MoreMenu`), просто с другим списком пунктов.
- `CreatePostModal` (обёртка формы) не меняется — уже адаптирована под
  мобильный форм-фактор (полноэкранная на мобильном, по центру на
  десктопе), меняется только её содержимое (`CreatePostForm`).

## Тестирование / приёмка

- `tsc --noEmit` чист.
- Живой тест на neeklo-стенде:
  - Десктоп: «Создать» → «Пост» (без канала у тестового аккаунта — сразу
    форма) → загрузка реального фото → публикация → пост виден в ленте
    **после перезагрузки страницы** и (если возможно проверить) во второй
    сессии/инкогнито — не только в текущем React-стейте.
  - Если тестовый аккаунт владеет каналом: «Создать» → «Пост» → «От
    канала «Имя»» → публикация → пост появляется и в канале, и (после
    reload) в общей ленте под категорией «Каналы».
  - «Видео»: минимум путь «от профиля» — реальный видеофайл, та же
    двойная проверка (reload + видимость).
  - Авто-открытие файл-пикера: после выбора типа в меню окно ОС для
    выбора файла открывается автоматически, без дополнительного клика по
    зоне загрузки.
  - Мобильные вьюпорты 360/390/430: `Drawer` открывается без прыжка
    layout, список пунктов корректен (2 или 4, в зависимости от владения
    каналом), форма-модалка адаптирована (не «десктопное окно впритык»).
  - Десктопный `UserMenu` после рефакторинга на `useHoverDropdown` ведёт
    себя идентично (regression-check на уже сегодняшний фикс: hover-open,
    hover-away закрывает, Escape закрывает, click-outside закрывает, без
    флика на стационарном курсоре).

## Коммиты

1. `feat(feed): redesign composer trigger — Создать menu with type+source selection` —
   `useHoverDropdown` + `UserMenu` рефактор, `CreatePostMenu.tsx`, удаление
   `CreatePostTrigger.tsx`, `feed.tsx` wiring, `CreatePostForm.tsx`
   схлопывание в один шаг + канальная ветка.
2. `fix(feed): auto-open file picker when composer opens` — `autoOpen`
   пропс на `ImageUploadGrid`/`VideoUploadField` + вызов из
   `CreatePostForm`.

## Не входит в эту фазу

- Публикация участниками сообществ — механизма нет вообще (см. находку),
  отдельная будущая фича вне рамок этой спеки.
- Множественное владение несколькими каналами одним пользователем — берём
  первый найденный `isOwner`-канал; продуктовая модель сегодня
  подразумевает не более одного канала на пользователя (по формулировке
  задачи — «канал, которым он владеет», единственное число).
- Выделенный бэкенд-эндпоинт `GET /channels/mine` — документируется как
  backend-need, не реализуется в этой фазе (текущий клиентский фильтр по
  `useChannels()` достаточен при текущем масштабе).
- Поле-дискриминатор «опубликовано как канал» на `Post`/в ленте — модель
  данных не меняется, канальные посты остаются неотличимы от обычных в
  ленте кроме категории «Каналы» (как сегодня).
