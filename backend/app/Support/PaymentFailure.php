<?php

namespace App\Support;

/**
 * Словарь причин отказа: наши коды поверх чужих.
 *
 * ЗАЧЕМ ПОВЕРХ. Провайдеров два и они отвечают по-разному: у ВТБ это
 * числовой `actionCode`, у ЮKassa была строка. Строить воронку на чужих
 * кодах значит получить два несводимых столбца. Поэтому у каждого отказа
 * есть наш код (по нему группируем) и рядом — то, что прислал провайдер,
 * дословно (по нему разбираем частный случай).
 *
 * ШАГ ОБРЫВА — отдельно от причины. «Не хватило денег» и «закрыл форму»
 * могут дать один и тот же `orderStatus 6`; различает их шаг, а не код.
 */
final class PaymentFailure
{
    /** Заказ завели, до формы банка человек не дошёл. */
    public const STAGE_CREATED = 'created';

    /** Форму открыл, платить не стал. */
    public const STAGE_FORM = 'form';

    /** Банк ответил отказом. */
    public const STAGE_BANK = 'bank';

    /** Узнать не удалось — в том числе у всех отказов до 30.09. */
    public const STAGE_UNKNOWN = 'unknown';

    /** Кто вынес решение. */
    public const BY_CALLBACK = 'callback';

    public const BY_RECONCILE = 'reconcile';

    public const BY_USER = 'user';

    /**
     * Решил наш шлюз, не дойдя до банка.
     *
     * Случай один: `register.do` вернул ответ без `orderId` или `formUrl`,
     * то есть заказа у банка нет и формы человек не увидит. Ни колбэк, ни
     * сверка тут ни при чём — отвечать некому.
     */
    public const BY_GATEWAY = 'gateway';

    /** Заказ не завели: банк не вернул номер или адрес формы. */
    public const CODE_REGISTER_FAILED = 'register_failed';

    /** @return array<string, string> шаг → как называть человеку */
    public static function stageLabels(): array
    {
        return [
            self::STAGE_CREATED => 'до формы не дошёл',
            self::STAGE_FORM => 'открыл форму, не заплатил',
            self::STAGE_BANK => 'банк отказал',
            self::STAGE_UNKNOWN => 'причина неизвестна',
        ];
    }

    /**
     * Наш код по ответу ВТБ.
     *
     * `actionCode` — код самого банка. Значения ниже взяты из его
     * документации и подтверждаются `actionCodeDescription`, который
     * приходит рядом; текст банка мы сохраняем целиком, так что ошибка в
     * этой таблице не потеряет исходных данных.
     *
     * Ноль и `null` — не отказ: заказ просто не оплачен.
     */
    public static function fromVtbActionCode(?int $actionCode): string
    {
        return match (true) {
            $actionCode === null => 'unknown',
            $actionCode === 0 => 'none',
            // Срок жизни заказа истёк — человек ушёл, банк закрыл заказ.
            in_array($actionCode, [-2007, -2005], true) => 'expired',
            in_array($actionCode, [116, -2004], true) => 'insufficient_funds',
            in_array($actionCode, [101, 110, 111], true) => 'card_problem',
            in_array($actionCode, [-2003, 119, 120, 123], true) => 'declined_by_bank',
            default => 'declined_other',
        };
    }

    /**
     * Наш код по ответу ЮKassa.
     *
     * Причина лежит в `cancellation_details.reason` — строкой, не числом,
     * и до 02.10 её не читал никто: поиск по `cancellation_details` по
     * `app`, `tests` и `docs` давал ноль вхождений. Сверка смотрела
     * только `status`, то есть знала «отменён», но не знала почему.
     *
     * Список значений — из документации ЮKassa. Неизвестное имя не
     * выдумываем в знакомое: оно идёт в `declined_other`, а само имя
     * остаётся в тексте рядом. Отсутствие причины — не причина: `null`,
     * и строку не трогаем.
     */
    public static function fromYooKassaReason(?string $reason): ?string
    {
        if ($reason === null || $reason === '') {
            return null;
        }

        return match ($reason) {
            'insufficient_funds' => 'insufficient_funds',
            // Человек не подтвердил платёж до истечения срока — он ушёл
            // с формы, банк отказа не выносил.
            'expired_on_confirmation' => 'expired',
            'expired_on_capture' => 'expired',
            '3d_secure_failed', 'card_expired', 'invalid_card_number', 'invalid_csc' => 'card_problem',
            'call_issuer', 'issuer_unavailable', 'general_decline',
            'payment_method_restricted', 'country_forbidden' => 'declined_by_bank',
            default => 'declined_other',
        };
    }

    /** @return array<string, string> наш код → как называть человеку */
    public static function codeLabels(): array
    {
        return [
            'expired' => 'срок заказа истёк',
            'insufficient_funds' => 'недостаточно средств',
            'card_problem' => 'проблема с картой',
            'declined_by_bank' => 'отказ банка',
            'declined_other' => 'иной отказ',
            'abandoned' => 'форма закрыта',
            self::CODE_REGISTER_FAILED => 'заказ не завёлся',
            'none' => 'без кода',
            'unknown' => 'неизвестно',
        ];
    }

    public static function label(?string $code): string
    {
        return self::codeLabels()[$code ?? 'unknown'] ?? (string) $code;
    }
}
