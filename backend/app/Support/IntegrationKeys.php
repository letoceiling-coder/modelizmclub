<?php

namespace App\Support;

use App\Models\SystemSetting;

/**
 * Ключи сторонних сервисов, которые включаются подстановкой значения.
 *
 * До 25.09 ключ Яндекс.Карт и номер счётчика Метрики жили в
 * `import.meta.env` фронтенда, то есть вшивались в сборку. Вставить их
 * значило пересобрать и выкатить — а без них карта пунктов СДЭК не
 * загружалась и статистика не собиралась вовсе.
 *
 * Теперь они приходят с `/public/bootstrap`, который фронт читает при
 * старте и который собирается из `system_settings`. Вставка значения в
 * админке действует со следующей загрузки страницы; кеш ответа
 * сбрасывается событием модели настройки.
 *
 * `import.meta.env` остаётся запасным путём: если в настройках пусто, а в
 * сборке значение есть — берётся оно. Так ничего не ломается у тех, кто
 * уже собирал с ключом.
 */
final class IntegrationKeys
{
    public const SETTING_KEY = 'integrations.keys';

    /**
     * Что отдаём фронтенду.
     *
     * Только то, что и так уезжает в браузер: ключ JS API карт виден в
     * адресе скрипта, номер счётчика — в коде Метрики. Секреты сюда класть
     * нельзя, и поэтому список закрытый, а не «всё из настройки».
     *
     * Коды подтверждения Вебмастера Яндекса и Search Console Google — тоже
     * здесь: это не секреты (их видно в разметке любой страницы, в том и
     * смысл), и вшивать их в сборку значило бы пересобирать фронтенд, чтобы
     * подтвердить права на сайт.
     *
     * @return array{yandex_maps_key: string, metrika_id: string, yandex_verification: string, google_verification: string}
     */
    public static function publicPayload(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $raw = is_array($raw) ? $raw : [];

        return [
            'yandex_maps_key' => self::строка($raw['yandex_maps_key'] ?? null),
            'metrika_id' => self::цифры($raw['metrika_id'] ?? null),
            'yandex_verification' => self::код($raw['yandex_verification'] ?? null),
            'google_verification' => self::код($raw['google_verification'] ?? null),
        ];
    }

    /**
     * Код подтверждения: из кабинета его копируют целым тегом
     * `<meta name="yandex-verification" content="abc123" />`, а нужно
     * только значение. Поэтому если в строке есть `content="…"` — берём
     * оттуда, иначе считаем строку самим кодом. Лишние кавычки и угловые
     * скобки убираем: с ними разметка выходит сломанной, а подтверждение
     * не проходит молча.
     */
    private static function код(mixed $value): string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return '';
        }

        if (preg_match('/content=["\']([^"\']+)["\']/', $raw, $m) === 1) {
            $raw = $m[1];
        }

        return trim(preg_replace('/[<>"\'\s]+/', '', $raw) ?? '');
    }

    private static function строка(mixed $value): string
    {
        return trim((string) ($value ?? ''));
    }

    /**
     * Номер счётчика — только цифры.
     *
     * Из кабинета Метрики его копируют вместе с посторонним: пробелами,
     * подписью «Номер счётчика», иногда всей строкой кода. Счётчик с
     * мусором в номере молча не заводится, и понять это можно только по
     * отсутствию визитов через сутки.
     */
    private static function цифры(mixed $value): string
    {
        return preg_replace('/\D+/', '', (string) ($value ?? '')) ?? '';
    }
}
