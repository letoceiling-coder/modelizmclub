# 50 — Компоненты

Срез `origin/master` @ `ecb4d60`. Использование считалось поиском имени
компонента по всем `.ts(x)` в `frontend/src`, кроме файла самого компонента.
Метод грубый: совпадение по имени, а не по импорту, поэтому счётчик завышен
для компонентов с общеупотребительными именами (`Button`, `Card`, `Input`).
Ноль использований — сигнал надёжный, большие числа — нет.

Компонентов всего: **244** — свои **182**, shadcn/ui **62**.

## Используются более чем в 5 файлах

| Компонент | Файл | Импортируется в |
|---|---|---:|
| `label` | `components/ui/label.tsx` | 190 |
| `button` | `components/ui/button.tsx` | 188 |
| `card` | `components/ui/card.tsx` | 129 |
| `input` | `components/ui/input.tsx` | 120 |
| `avatar` | `components/ui/avatar.tsx` | 59 |
| `select` | `components/ui/select.tsx` | 58 |
| `Icon` | `components/ui/Icon.tsx` | 54 |
| `dialog` | `components/ui/dialog.tsx` | 50 |
| `GuestAccessProvider` | `components/access/GuestAccessProvider.tsx` | 41 |
| `AppLayout` | `components/layout/AppLayout.tsx` | 33 |
| `form` | `components/ui/form.tsx` | 32 |
| `textarea` | `components/ui/textarea.tsx` | 28 |
| `badge` | `components/ui/badge.tsx` | 27 |
| `toggle` | `components/ui/toggle.tsx` | 25 |
| `checkbox` | `components/ui/checkbox.tsx` | 21 |
| `EmptyState` | `components/EmptyState.tsx` | 21 |
| `skeleton` | `components/ui/skeleton.tsx` | 20 |
| `empty-state` | `components/ui/empty-state.tsx` | 20 |
| `Skeleton` | `components/feed/Skeleton.tsx` | 19 |
| `PhotoEditorDialog` | `components/media/PhotoEditorDialog.tsx` | 18 |
| `switch` | `components/ui/switch.tsx` | 17 |
| `carousel` | `components/ui/carousel.tsx` | 15 |
| `sheet` | `components/ui/sheet.tsx` | 15 |
| `tabs` | `components/ui/tabs.tsx` | 15 |
| `GuestGuardLink` | `components/access/GuestGuardLink.tsx` | 12 |
| `Logo` | `components/Logo.tsx` | 12 |
| `SettingsSectionShell` | `components/settings/SettingsSectionShell.tsx` | 11 |
| `IconBox` | `components/ui/IconBox.tsx` | 9 |
| `progress` | `components/ui/progress.tsx` | 9 |
| `alert` | `components/ui/alert.tsx` | 9 |
| `table` | `components/ui/table.tsx` | 9 |
| `ComplaintDialog` | `components/friends/ComplaintDialog.tsx` | 9 |
| `sidebar` | `components/ui/sidebar.tsx` | 8 |
| `popover` | `components/ui/popover.tsx` | 8 |
| `dropdown-menu` | `components/ui/dropdown-menu.tsx` | 7 |
| `Sidebar` | `components/layout/Sidebar.tsx` | 7 |
| `DirectionsRightRail` | `components/layout/DirectionsRightRail.tsx` | 6 |
| `pagination` | `components/ui/pagination.tsx` | 6 |
| `reduced-motion-switch` | `components/ui/reduced-motion-switch.tsx` | 6 |
| `PageSkeletons` | `components/boot/PageSkeletons.tsx` | 6 |
| `search-input` | `components/ui/search-input.tsx` | 6 |

## Не используются нигде

Найдено **23**.

| Компонент | Файл |
|---|---|
| `CommunitySkeleton` | `components/communities/CommunitySkeleton.tsx` |
| `CreateChooserModal` | `components/CreateChooserModal.tsx` |
| `CreatePostMenu 2` | `components/feed/CreatePostMenu 2.tsx` |
| `FeedFilters` | `components/FeedFilters.tsx` |
| `InfiniteLoader` | `components/InfiniteLoader.tsx` |
| `LanguageSwitcher` | `components/messenger/LanguageSwitcher.tsx` |
| `PaymentModal` | `components/PaymentModal.tsx` |
| `PostGallery` | `components/feed/PostGallery.tsx` |
| `SuccessModal` | `components/ads/wizard/SuccessModal.tsx` |
| `VideoActionsMenu` | `components/reviews/VideoActionsMenu.tsx` |
| `accordion` | `components/ui/accordion.tsx` |
| `command` | `components/ui/command.tsx` |
| `context-menu` | `components/ui/context-menu.tsx` |
| `hover-card` | `components/ui/hover-card.tsx` |
| `inn-input 2` | `components/ui/inn-input 2.tsx` |
| `input-otp` | `components/ui/input-otp.tsx` |
| `menubar` | `components/ui/menubar.tsx` |
| `navigation-menu` | `components/ui/navigation-menu.tsx` |
| `password-strength 2` | `components/ui/password-strength 2.tsx` |
| `radio-group` | `components/ui/radio-group.tsx` |
| `resizable` | `components/ui/resizable.tsx` |
| `scroll-area` | `components/ui/scroll-area.tsx` |
| `toggle-group` | `components/ui/toggle-group.tsx` |

## Возможные дубликаты по имени

| Основа | Варианты |
|---|---|
| `CreatePost` | `CreatePostForm` (`components/CreatePostForm.tsx`), `CreatePostMenu` (`components/feed/CreatePostMenu.tsx`), `CreatePostModal` (`components/feed/CreatePostModal.tsx`) |
