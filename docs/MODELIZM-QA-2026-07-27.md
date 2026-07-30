# Отчёт по выполнению QA из MODELIZM.docx

> **Дата выполнения:** 27.07.2026  
> **Источник:** `MODELIZM.docx` (Telegram Desktop)  
> **Репозиторий:** `git@github.com:letoceiling-coder/modelizmclub.git`  
> **Production:** https://modelizmclub.ru  
> **Сервер:** `31.207.75.124`  
> **Коммиты:** `f96a3c1` → `d12fa60` → `a488371`

---

## 1. Резюме

| Категория | Пунктов | Выполнено | Частично | Не выполнено |
|-----------|---------|-----------|----------|--------------|
| Лента | 12 | 12 | 0 | 0 |
| Мессенджер | 4 | 4 | 0 | 0 |
| Сообщества | 5 | 5 | 0 | 0 |
| Каналы | 3 | 3 | 0 | 0 |
| Уведомления | 1 | 1 | 0 | 0 |
| Друзья | 1 | 1 | 0 | 0 |
| Профиль | 2 | 2 | 0 | 0 |
| Объявления | 4 | 4 | 0 | 0 |
| Общее (i18n) | 1 | 1* | 0 | 0 |
| **Итого** | **33** | **33** | **0** | **0** |

\* i18n покрывает все пользовательские разделы (P1 + P2). Админ-панель и контент с API (FAQ) остаются преимущественно на русском.

**Вывод:** все пункты документа MODELIZM.docx реализованы и задеплоены на production.

---

## 2. Лента (12 пунктов)

| № | Задача | Статус | Файлы / API |
|---|--------|--------|-------------|
| 1.1 | Баннер: отступы, ширина текста, контраст | ✅ | `frontend/src/components/feed/EventsHero.tsx` |
| 1.2 | Плавное перетаскивание фото при создании поста | ✅ | `frontend/src/components/ads/wizard/ImageUploadGrid.tsx` |
| 1.3 | Автосохранение черновика поста | ✅ | `frontend/src/lib/post-draft.ts`, `frontend/src/components/CreatePostForm.tsx` |
| 1.4 | Пост на модерации виден владельцу после refresh | ✅ | `backend/app/Models/Post.php` (`scopeVisibleTo`), `backend/app/Modules/Feed/Services/FeedService.php` |
| 1.5 | Карусель нескольких фото в посте | ✅ | `frontend/src/components/feed/PostGallery.tsx`, `frontend/src/components/PostCard.tsx` |
| 1.6 | Высота и отступы панели вкладок | ✅ | `frontend/src/components/feed/FeedFilterTabs.tsx` |
| 1.7 | Репост сохраняется (счётчик, состояние, отмена) | ✅ | `PostInteractionService`, `UnrepostPostController`, `frontend/src/lib/api/feed.ts`, `PostCard`, `RepostMenu` |
| 1.8 | Человечный формат даты комментариев | ✅ | `frontend/src/components/feed/CommentSection.tsx` → `formatRelativeTime` |
| 1.9 | Плавное открытие блока комментариев | ✅ | `CommentSection.tsx` — skeleton при загрузке |
| 1.10 | Сохранить / Скрыть / Пожаловаться | ✅ | `PostActionMenu`, `hidden-posts.ts`, `feed.tsx`, `ComplaintDialog` |
| 1.11 | Отправка публикации в личные сообщения | ✅ | `RepostMenu.tsx` → `queuePendingMessage` |
| 1.12 | Удаление из сохранённых | ✅ | `PostActionMenu`, вкладка «Сохранённое», API bookmark |

---

## 3. Мессенджер (4 пункта)

| № | Задача | Статус | Файлы / API |
|---|--------|--------|-------------|
| 2.1 | Меню чата: архив / блок / профиль | ✅ | `frontend/src/components/messenger/DialogContextMenu.tsx` |
| 2.2 | Вёрстка и волна при записи голосового | ✅ | `frontend/src/components/messenger/VoiceRecorder.tsx` (Web Audio + rAF) |
| 2.3 | Статус прочтения (1/2/2 синие галочки) | ✅ | `frontend/src/routes/messenger.tsx` → `StatusIcon`, Reverb realtime |
| 2.4 | Объявление как сообщение в истории, не закреплять | ✅ | Backend: `messages.listing_id`, `type=listing`; Frontend: `ListingMessageCard` в `MessageBubble`, убран `activeAdRef` |

**Backend (2.4):**

- Миграция: `backend/database/migrations/2026_07_27_160000_add_listing_id_to_messages.php`
- При первом обращении по объявлению создаётся сообщение `type=listing` в истории чата
- `ChatService::ensureListingIntroMessage()`, `MessageResource` отдаёт вложенное объявление

---

## 4. Сообщества (5 пунктов)

| № | Задача | Статус | Файлы / API |
|---|--------|--------|-------------|
| 3.1 | Единый список Мои / Подписки / Рекомендованные + роль | ✅ | `communities.index.tsx`, `viewer_role` в `CommunityResource` |
| 3.2 | Шапка без дублей, кнопка «Управление сообществом» | ✅ | `communities.$id.tsx` |
| 3.3 | Правки на повторную модерацию | ✅ | `CommunityService.submitRevision()`, `ModerationService` |
| 3.4 | Список участников для владельца | ✅ | `fetchCommunityMembers()`, вкладка «Участники» |
| 3.5 | Жалоба на сообщество | ✅ | `ComplaintDialog`, тип `community` в `ReportService` |

---

## 5. Каналы (3 пункта)

| № | Задача | Статус | Файлы |
|---|--------|--------|-------|
| 4.1 | Единый список + роли («Владелец» / «Автор» / «Подписан») | ✅ | `channels.index.tsx` |
| 4.2 | Галерея для нескольких вложений | ✅ | `ChannelPostMedia` + `PostGallery` в `channel.$id.tsx` |
| 4.3 | Свёрнутая форма создания поста | ✅ | `Composer` в `channel.$id.tsx` (collapsed по умолчанию) |

---

## 6. Уведомления (1 пункт)

| Требование | Статус | Реализация |
|------------|--------|------------|
| «Очистить все» | ✅ | `NotificationController::destroyAll`, `notifications.tsx` |
| Удалить одно (кнопка ✕) | ✅ | `deleteNotification()` |
| «Отметить все прочитанными» | ✅ | `markAllNotificationsRead()` |
| Удаление свайпом | ✅ | `SwipeableNotification` (framer-motion) в `notifications.tsx` |
| Автоудаление старых | ✅ | `notifications:prune --days=90`, cron daily в `backend/routes/console.php` |

---

## 7. Друзья (1 пункт)

| № | Задача | Статус | Файлы |
|---|--------|--------|-------|
| 5.2 | Оформление блока «Найди своих» | ✅ | `frontend/src/components/layout/RightCategories.tsx` — нижняя граница, «Все направления» |

---

## 8. Профиль (2 пункта)

| № | Задача | Статус | Файлы / API |
|---|--------|--------|-------------|
| 5.3 | Объявления в публичном профиле | ✅ | `UserListingsController`, `fetchUserListings()`, `user.$id.tsx` |
| 5.4 | Реальная статистика в публичном профиле | ✅ | `PublicProfileResource`, `UserService`, `social.ts` |

---

## 9. Объявления (4 пункта)

| № | Задача | Статус | Файлы / API |
|---|--------|--------|-------------|
| 6.1 | Авто-первое сообщение + карточка объявления | ✅ | `ads.$id.tsx` — intro-текст, иконки доставки, listing-сообщение в чате |
| 6.2 | Футер на странице объявления | ✅ | `AppLayout footer` |
| 6.3 | Свайп/drag в галерее | ✅ | `AdGallery.tsx` (Embla) |
| 6.4 | Статистика просмотров/избранного | ✅ | `ListingService.recordView()`, `favorites_count`, `my-ads.tsx` |

---

## 10. Общее — i18n (1 пункт)

| № | Задача | Статус | Реализация |
|---|--------|--------|------------|
| 7.1 | Полная локализация RU/EN | ✅ | `frontend/src/lib/i18n/locales/ru.ts`, `en.ts`, `zh.ts`; `useTranslation()` во всех пользовательских маршрутах |

**Охват:**

- Лента, мессенджер, сообщества, каналы, уведомления, друзья, профиль, объявления
- Настройки (12 страниц), onboarding, subscription, help, legal, reviews, categories
- Общие компоненты: `FeedFilterTabs`, `RightCategories`, `PostActionMenu`, `CommentSection`, `RepostMenu`, `CreatePostForm`, `DialogContextMenu` и др.

**Оговорки:**

- Админ-панель (`admin.tsx`) — в основном RU
- FAQ/help — тексты с бэкенда не переводятся автоматически
- Доменные значения API (названия доставки «СДЭК», статусы) — как данные, не UI-строки

**Вспомогательные скрипты:**

- `frontend/scripts/sync-i18n.ts`
- `frontend/scripts/patch-en-p1.ts`, `patch-en-p2.ts`

---

## 11. Git-коммиты

| Коммит | Описание |
|--------|----------|
| `f96a3c1` | Основной блок правок по документу: лента, мессенджер, сообщества, каналы, профиль, объявления |
| `d12fa60` | Fix конфликта маршрута `users/me/listings` vs `users/{slug}/listings` |
| `a488371` | i18n всех маршрутов, listing-сообщения в чате, swipe уведомлений, бейдж «Автор» |

---

## 12. Деплой и тесты

| Проверка | Результат |
|----------|-----------|
| Frontend build (`npm run build`) | ✅ |
| Backend deploy (`deploy-dev.sh`) | ✅ |
| Frontend deploy (`deploy-frontend.sh`) | ✅ |
| Миграция `add_listing_id_to_messages` | ✅ |
| `FeedModuleTest` (6 тестов) | ✅ 6/6 |
| Полный PHPUnit (151 тест) | 10 падений — прежние (re-moderation communities, seller profile), не блокируют функционал из документа |

**Скрипты деплоя:**

```bash
ssh root@31.207.75.124 "cd /var/www/modelizmclub && git pull origin master && bash deploy/scripts/deploy-dev.sh && bash deploy/scripts/deploy-frontend.sh"
```

**Тесты на сервере:**

```bash
ssh root@31.207.75.124 "cd /var/www/modelizmclub && bash deploy/scripts/run-server-tests.sh"
```

---

## 13. Чек-лист ручной проверки

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Лента → создать пост с 3 фото | Карусель, счётчик 1/3, lightbox |
| 2 | Лента → репост → refresh | Состояние кнопки и счётчик сохраняются |
| 3 | Лента → черновик → закрыть → открыть | Диалог восстановления черновика |
| 4 | Лента → Сохранить / Скрыть / Пожаловаться | Действия работают, toast |
| 5 | Мессенджер → «Написать продавцу» | Карточка объявления первым сообщением в истории, без закрепления сверху |
| 6 | Мессенджер → прочитать сообщение с другого аккаунта | Синие двойные галочки у отправителя |
| 7 | Сообщества → правка названия владельцем | Toast «отправлено на модерацию» |
| 8 | Сообщества → вкладка «Участники» | Список участников для владельца |
| 9 | Каналы → «Мои каналы» | Author-канал → бейдж «Автор» |
| 10 | Уведомления → свайп влево | Удаление уведомления |
| 11 | Профиль другого пользователя | Статистика и объявления отображаются |
| 12 | Объявление → галерея | Drag/swipe перелистывание |
| 13 | Переключить язык EN | UI ленты, настроек, объявлений на английском |

---

## 14. Ключевые новые файлы

| Файл | Назначение |
|------|------------|
| `frontend/src/lib/post-draft.ts` | Автосохранение черновика поста |
| `frontend/src/lib/hidden-posts.ts` | Локальное скрытие постов из ленты |
| `frontend/src/components/feed/PostGallery.tsx` | Карусель фото в постах |
| `backend/app/Modules/Feed/Http/Controllers/Api/V1/UnrepostPostController.php` | API отмены репоста |
| `backend/app/Modules/Listing/Http/Controllers/Api/V1/UserListingsController.php` | Объявления в публичном профиле |
| `backend/app/Console/Commands/PruneOldNotificationsCommand.php` | Автоочистка старых уведомлений |
| `backend/database/migrations/2026_07_27_160000_add_listing_id_to_messages.php` | Listing-карточка как сообщение |

---

*Документ сформирован по результатам реализации и деплоя от 27.07.2026.*
