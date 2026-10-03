<?php

namespace Modules\PublicContent\Services;

use App\Models\SystemSetting;
use App\Models\User;
use App\Support\FeedGuestAccessRegistry;
use Illuminate\Validation\ValidationException;

class FeedGuestAccessService
{
    /** @return array<string, mixed> */
    public function publicPayload(): array
    {
        return $this->mergedConfig();
    }

    /** @return array<string, mixed> */
    public function adminPayload(): array
    {
        $config = $this->mergedConfig();

        return [
            'config' => $config,
            'registry' => FeedGuestAccessRegistry::actions(),
            'group_labels' => FeedGuestAccessRegistry::groupLabels(),
        ];
    }

    /** @param array<string, mixed> $payload */
    public function update(array $payload): array
    {
        $defaults = FeedGuestAccessRegistry::defaultConfig();
        $incomingActions = is_array($payload['actions'] ?? null) ? $payload['actions'] : [];

        $actions = [];
        foreach (FeedGuestAccessRegistry::actions() as $row) {
            $key = $row['key'];
            $patch = is_array($incomingActions[$key] ?? null) ? $incomingActions[$key] : [];
            $actions[$key] = FeedGuestAccessRegistry::normalizeAction(
                $patch,
                (string) $row['default_min_tier'],
            );
        }

        /*
         * Пункт меню не может быть строже страницы за ним.
         *
         * Договорённость 05.09 (`docs/gate.md`): открытую гостю страницу
         * должно быть куда нажать. Разбор 03.10 нашёл карту, где
         * `layout.nav.communities` и `layout.nav.channels` стояли
         * `subscription` при `guest` у страниц: гость видел пункты, нажимал и
         * получал окно подписки вместо открытой ему страницы.
         *
         * Проверка стоит здесь, а не в контроллере, по двум причинам. Первая:
         * здесь уже собрана **итоговая** карта, а контроллер держит только
         * заплатки — по ним пару не сверить. Вторая: через сервис пишут не
         * только из админки, и правило должно держаться для любого, кто
         * позовёт `update()`.
         */
        $расхождения = FeedGuestAccessRegistry::расхожденияНавигации($actions);

        if ($расхождения !== []) {
            throw ValidationException::withMessages(
                collect($расхождения)->mapWithKeys(fn (array $пара) => [
                    "actions.{$пара['nav']}.min_tier" => sprintf(
                        'Пункт меню требует «%s», а страница %s открыта на «%s». '
                        .'Открытую страницу должно быть куда нажать — опустите пункт до «%s» '
                        .'либо поднимите страницу.',
                        $пара['nav_tier'],
                        $пара['route'],
                        $пара['route_tier'],
                        $пара['route_tier'],
                    ),
                ])->all()
            );
        }

        $stored = [
            'version' => 2,
            'default_deny_mode' => in_array($payload['default_deny_mode'] ?? 'popup', ['popup', 'redirect'], true)
                ? ($payload['default_deny_mode'] ?? 'popup')
                : 'popup',
            'popup' => [
                'title' => trim((string) ($payload['popup']['title'] ?? $defaults['popup']['title'])),
                'description' => trim((string) ($payload['popup']['description'] ?? $defaults['popup']['description'])),
                'primary_cta' => trim((string) ($payload['popup']['primary_cta'] ?? $defaults['popup']['primary_cta'])),
                'secondary_cta' => trim((string) ($payload['popup']['secondary_cta'] ?? $defaults['popup']['secondary_cta'])),
            ],
            'actions' => $actions,
        ];

        SystemSetting::query()->updateOrCreate(
            ['key' => FeedGuestAccessRegistry::SETTING_KEY],
            ['value' => $stored, 'group' => 'feed'],
        );

        return $this->mergedConfig();
    }

    /**
     * Уровень действия из итоговой карты: `guest`, `auth` или `subscription`.
     *
     * Та же сборка, что уходит в интерфейс (`publicPayload`), — сервер и
     * клиент читают одно правило. Для ключа из реестра уровень есть всегда:
     * `normalizeAction` подставляет умолчательный. Неизвестный ключ или
     * испорченное значение — самый строгий уровень: ошибка в имени ключа не
     * должна тихо открывать действие.
     */
    public function minTier(string $actionKey): string
    {
        $tier = $this->mergedConfig()['actions'][$actionKey]['min_tier'] ?? null;

        return is_string($tier) && in_array($tier, FeedGuestAccessRegistry::TIERS, true) ? $tier : 'subscription';
    }

    /**
     * Хватает ли вошедшему человеку подписки для действия по карте.
     *
     * Одно правило на все места, где сервер его применяет: middleware
     * `requiresSubscription:<ключ>` и планировщик отложенных записей. Уровень
     * `guest` и `auth` подписки не требует (вход проверяет маршрут), уровень
     * `subscription` — требует; проходит и льгота «подписка не требуется»
     * (по умолчанию у сотрудников, см. RolePrivileges).
     */
    public function subscriptionSatisfied(User $user, string $actionKey): bool
    {
        if ($this->minTier($actionKey) !== 'subscription') {
            return true;
        }

        return $user->hasSubscriptionAccess();
    }

    /** @return array<string, mixed> */
    private function mergedConfig(): array
    {
        $defaults = FeedGuestAccessRegistry::defaultConfig();
        $row = SystemSetting::query()->where('key', FeedGuestAccessRegistry::SETTING_KEY)->first();
        $stored = is_array($row?->value) ? $row->value : [];

        $actions = [];
        foreach (FeedGuestAccessRegistry::actions() as $meta) {
            $key = $meta['key'];
            $patch = is_array($stored['actions'][$key] ?? null) ? $stored['actions'][$key] : [];
            $actions[$key] = FeedGuestAccessRegistry::normalizeAction(
                $patch,
                (string) $meta['default_min_tier'],
            );
        }

        return [
            'version' => 2,
            'default_deny_mode' => in_array($stored['default_deny_mode'] ?? 'popup', ['popup', 'redirect'], true)
                ? ($stored['default_deny_mode'] ?? 'popup')
                : 'popup',
            'popup' => [
                'title' => trim((string) ($stored['popup']['title'] ?? $defaults['popup']['title'])),
                'description' => trim((string) ($stored['popup']['description'] ?? $defaults['popup']['description'])),
                'primary_cta' => trim((string) ($stored['popup']['primary_cta'] ?? $defaults['popup']['primary_cta'])),
                'secondary_cta' => trim((string) ($stored['popup']['secondary_cta'] ?? $defaults['popup']['secondary_cta'])),
            ],
            'actions' => $actions,
        ];
    }
}
