<?php

namespace App\Support;

use App\Models\SystemSetting;

/**
 * Во что обходятся баллы: цены в баллах на размещение и продвижение.
 *
 * ПОЧЕМУ ИМЕННО ЭТИ ДВЕ ВЕЩИ. Размещение и продвижение — то, за что и так
 * платят деньгами, значит баллы их замещают естественно. Подписка баллами
 * не покрывается: она месячная, и её выгоднее продавать за деньги. Ключа
 * под подписку здесь нет вовсе — не «выключен», а не существует, чтобы
 * никто не включил его по недосмотру.
 *
 * ЦЕНА В БАЛЛАХ, А НЕ КУРС. Курс «баллов за рубль» пришлось бы умножать
 * на цену, а цена размещения зависит от категории и промокода. Тогда одно
 * и то же размещение стоило бы разное число баллов, и человек не мог бы
 * заранее знать, хватает ли ему. Поэтому цена в баллах назначается прямо,
 * числом, и от рублёвой не зависит.
 *
 * НОЛЬ — НЕЛЬЗЯ ОПЛАТИТЬ. Не «бесплатно»: бесплатное размещение у нас уже
 * есть и живёт своим механизмом (запас размещений). Ноль здесь означает,
 * что этот способ оплаты для этой вещи не предлагается.
 */
final class BonusPointsPrices
{
    public const SETTING_KEY = 'bonus_points_prices';

    public const GROUP = 'marketing';

    /** @return array{enabled: bool, listing_placement: int, boosts: array<string, int>} */
    public static function get(): array
    {
        return self::normalize(
            SystemSetting::query()->where('key', self::SETTING_KEY)->value('value')
        );
    }

    /** @return array{enabled: bool, listing_placement: int, boosts: array<string, int>} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            // Начальный курс: сто баллов за размещение. Столько же даёт один
            // приглашённый друг — то есть друг равен размещению.
            'listing_placement' => 100,
            'boosts' => [],
        ];
    }

    /** @return array{enabled: bool, listing_placement: int, boosts: array<string, int>} */
    public static function normalize(mixed $raw): array
    {
        $defaults = self::defaults();
        $base = is_array($raw) ? $raw : [];

        $enabled = $base['enabled'] ?? $defaults['enabled'];
        if (is_string($enabled)) {
            $enabled = filter_var($enabled, FILTER_VALIDATE_BOOLEAN);
        }

        $boosts = [];
        foreach ((array) ($base['boosts'] ?? []) as $id => $points) {
            $id = trim((string) $id);
            if ($id === '') {
                continue;
            }
            $boosts[$id] = self::цена($points);
        }

        return [
            'enabled' => (bool) $enabled,
            'listing_placement' => self::цена($base['listing_placement'] ?? $defaults['listing_placement']),
            'boosts' => $boosts,
        ];
    }

    /** Сколько баллов стоит размещение. Ноль — баллами нельзя. */
    public static function forPlacement(): int
    {
        $prices = self::get();

        return $prices['enabled'] ? $prices['listing_placement'] : 0;
    }

    /** Сколько баллов стоит этот пакет продвижения. Ноль — баллами нельзя. */
    public static function forBoost(string $packageId): int
    {
        $prices = self::get();

        return $prices['enabled'] ? (int) ($prices['boosts'][$packageId] ?? 0) : 0;
    }

    /**
     * Потолок в миллион — не про щедрость, а про опечатку: цена, которую
     * никто не может заплатить, тихо отключила бы способ оплаты, и
     * выглядело бы это поломкой, а не настройкой.
     */
    private static function цена(mixed $значение): int
    {
        return max(0, min(1000000, (int) $значение));
    }
}
