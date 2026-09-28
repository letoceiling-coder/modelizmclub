<?php

namespace App\Support;

use App\Models\SystemSetting;

/**
 * Настройки акции «Пригласи друга».
 *
 * ЧТО ИЗМЕНИЛОСЬ 28.09. Награда была зашита тремя разными способами сразу:
 * штуки размещений (`reward_listing_credits`), дни подписки
 * (`reward_subscription_days`) и **настоящие деньги в кошелёк**
 * (`reward_kopecks` → `WalletService::credit`, откуда есть вывод). Последнее
 * по умолчанию стояло нулём и не использовалось, но механика была живой.
 *
 * Теперь награда одна — бонусные баллы. Деньги за приглашение не
 * начисляются вовсе: баллы выводу не подлежат, и держать рядом вторую
 * награду, которая выводится, значило бы стирать эту границу.
 *
 * ПРЕДЕЛ СЧИТАЕТСЯ В ПРИГЛАШЕНИЯХ, А НЕ В НАГРАДЕ. Прежний `max_bonus`
 * сравнивался с **суммой** начисленного. При награде «1 штука за друга» это
 * случайно совпадало с числом приглашений, а при «100 баллов» предел в 10
 * сработал бы после первого же друга. Поэтому `max_paid_invites` — счёт
 * завершённых приглашений.
 *
 * СТАРЫЕ КЛЮЧИ ИЗ `system_settings` НЕ ЧИТАЮТСЯ. Перенос сделан миграцией
 * `2026_09_28_120000_referral_reward_becomes_points`; читать их ещё и здесь
 * значило бы держать два источника одной величины.
 */
final class ReferralProgramConfig
{
    public const SETTING_KEY = 'referral_program';

    /** Текст условий по умолчанию — то, что видно на странице до правки. */
    public const DEFAULT_TERMS = 'Баллы начисляются за каждого друга, который зарегистрировался по вашей ссылке и подтвердил телефон. Переход по ссылке сам по себе награды не даёт. Баллы не выводятся деньгами.';

    /**
     * @return array{enabled: bool, points_per_invite: int, max_paid_invites: int, terms: string}
     */
    public static function get(): array
    {
        return self::normalize(
            SystemSetting::query()->where('key', self::SETTING_KEY)->value('value')
        );
    }

    /** @return array{enabled: bool, points_per_invite: int, max_paid_invites: int, terms: string} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'points_per_invite' => 100,
            /*
             * Ноль — «без предела». Отдельного флага не заводим: ноль
             * оплачиваемых приглашений не имеет самостоятельного смысла
             * (это то же самое, что выключить акцию), и значение занято
             * под «сколько угодно».
             */
            'max_paid_invites' => 0,
            'terms' => self::DEFAULT_TERMS,
        ];
    }

    /** @return array{enabled: bool, points_per_invite: int, max_paid_invites: int, terms: string} */
    public static function normalize(mixed $raw): array
    {
        $defaults = self::defaults();
        $base = is_array($raw) ? $raw : [];

        $enabled = $base['enabled'] ?? $defaults['enabled'];
        if (is_string($enabled)) {
            $enabled = filter_var($enabled, FILTER_VALIDATE_BOOLEAN);
        }

        $terms = $base['terms'] ?? $defaults['terms'];
        $terms = is_string($terms) ? trim($terms) : $defaults['terms'];

        return [
            'enabled' => (bool) $enabled,
            /*
             * Потолок в десять тысяч — не про щедрость, а про опечатку:
             * лишний ноль в поле админки иначе раздал бы людям баланс,
             * который потом пришлось бы отбирать руками.
             */
            'points_per_invite' => max(0, min(10000, (int) ($base['points_per_invite'] ?? $defaults['points_per_invite']))),
            'max_paid_invites' => max(0, min(100000, (int) ($base['max_paid_invites'] ?? $defaults['max_paid_invites']))),
            'terms' => $terms === '' ? $defaults['terms'] : mb_substr($terms, 0, 1000),
        ];
    }
}
