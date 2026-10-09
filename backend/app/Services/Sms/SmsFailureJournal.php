<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Cache;

/**
 * Последний отказ отправки SMS — чтобы он не остался только в журнале сервера.
 *
 * Решение Ж5 требует не только честного текста человеку, но и «записи в
 * журнал и заметного предупреждения в админке». Журнал у отказов был и до
 * 09.10 (`Log::error` в `SmsMessenger` и в `PhoneVerificationService`), а вот
 * в админке не было ничего: владелец видел «SMS: настроено — да» ровно до тех
 * пор, пока не спрашивал живого человека, приходит ли код.
 *
 * Хранится в кеше, а не в таблице: нужен один последний случай, а не история,
 * и заводить миграцию ради одной строки незачем. Срок — неделя: отказ
 * недельной давности о сегодняшнем состоянии уже ничего не говорит.
 *
 * **Ни номера, ни ключей здесь нет.** Записывается причина, время, драйвер и
 * техническое сообщение шлюза, из которого номер вырезан: админка — не место
 * для чужих телефонов, а правило 8 раздела 2 прямо запрещает писать личные
 * данные в отчёты.
 */
class SmsFailureJournal
{
    private const KEY = 'sms:last-failure';

    private const TTL_SECONDS = 7 * 24 * 60 * 60;

    public function record(SmsFailureReason $reason, string $driver, string $technical): void
    {
        Cache::put(self::KEY, [
            'at' => now()->toIso8601String(),
            'reason' => $reason->value,
            'our_fault' => $reason->ourFault(),
            'driver' => $driver,
            'hint' => $reason->adminHint(),
            'technical' => self::withoutPhones($technical),
        ], self::TTL_SECONDS);
    }

    /** @return array<string, mixed>|null */
    public function last(): ?array
    {
        $value = Cache::get(self::KEY);

        return is_array($value) ? $value : null;
    }

    public function forget(): void
    {
        Cache::forget(self::KEY);
    }

    /**
     * Вырезает телефоны из технического текста.
     *
     * Шлюзы возвращают номер получателя в теле ответа, и это тело уходит в
     * сообщение исключения целиком. В админке номер не нужен: владельцу важно,
     * что именно сказал шлюз, а не кому не дошло.
     */
    private static function withoutPhones(string $text): string
    {
        return trim(mb_substr(
            (string) preg_replace('/\+?7\d{10}/', '<номер>', $text),
            0,
            500,
        ));
    }
}
