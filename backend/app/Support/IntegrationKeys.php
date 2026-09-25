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
     * @return array{yandex_maps_key: string, metrika_id: string}
     */
    public static function publicPayload(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $raw = is_array($raw) ? $raw : [];

        return [
            'yandex_maps_key' => self::строка($raw['yandex_maps_key'] ?? null),
            'metrika_id' => self::цифры($raw['metrika_id'] ?? null),
        ];
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
