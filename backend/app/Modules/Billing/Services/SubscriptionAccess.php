<?php

namespace Modules\Billing\Services;

use App\Models\UserSubscription;

/**
 * Ответ на один вопрос: открыт человеку доступ по подписке — и на каком
 * основании.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ТИП. Сводку о подписке считали в четырёх местах, и все
 * четыре — из `status` и `ends_at` строки, не спрашивая
 * `User::hasActiveSubscription()`:
 *
 *   - `Modules\Auth\Http\Resources\UserResource::subscriptionSummary()`
 *   - `Modules\Admin\...\AdminUserCardController::подписка()`
 *   - `Modules\Admin\...\AdminUserSubscriptionController` — в ответе
 *   - и ещё раз в `SubscriptionResource`, но там это верно: его контроллер
 *     сначала гейтит по `hasActiveSubscription()`, и до ресурса доходят
 *     только строки с настоящим доступом.
 *
 * ЧЕМ ЭТО ОБХОДИЛОСЬ. Разбор 03.10, пользователь 1201: строка подписки
 * `active` до 24.02.2027, админка показывает «активна до 24.02.2027», а
 * продукт отказывает. Основания нет ни одного — оплата была через тестовый
 * эквайринг (`provider = stub`, `metadata.test_acquiring = true`), а такие
 * `hasPaidSubscriptionPayment()` не признаёт, когда настоящий шлюз живой.
 * Сотрудник поддержки читает админку и отвечает человеку неправду.
 *
 * ЧТО ЭТО НЕ ДЕЛАЕТ. Правил доступа тип не меняет: он их только называет.
 * Решает по-прежнему `hasActiveSubscription()`, и исключение stub остаётся
 * исключением — за тестовый эквайринг денег не брали.
 */
final class SubscriptionAccess
{
    /** Нет строки подписки вовсе. */
    public const НЕТ_СТРОКИ = 'no_subscription';

    /** Освобождён от подписки (`users.subscription_exempt`). */
    public const ОСВОБОЖДЁН = 'exempt';

    /** Оплачено настоящим шлюзом. */
    public const ОПЛАЧЕНО = 'paid';

    /** Выдана руками из админки (`granted_by_admin_id`). */
    public const ВЫДАНА = 'granted';

    /** Промо «первая сотня». */
    public const ПЕРВАЯ_СОТНЯ = 'first_hundred';

    /**
     * Строка есть и выглядит живой, а основания нет.
     *
     * Ровно случай 1201. Это не «истекла» и не «отменена» — это строка,
     * которой продукт не верит, и в интерфейсе её надо называть именно так,
     * а не «активна».
     */
    public const БЕЗ_ОСНОВАНИЯ = 'no_basis';

    private const ПОДПИСИ = [
        self::НЕТ_СТРОКИ => 'подписки нет',
        self::ОСВОБОЖДЁН => 'освобождён от подписки',
        self::ОПЛАЧЕНО => 'оплачено',
        self::ВЫДАНА => 'выдана из админки',
        self::ПЕРВАЯ_СОТНЯ => 'первая сотня',
        self::БЕЗ_ОСНОВАНИЯ => 'строка есть, основания нет',
    ];

    private function __construct(
        public readonly bool $доступ,
        public readonly string $основание,
        public readonly ?UserSubscription $строка,
    ) {}

    public static function make(bool $доступ, string $основание, ?UserSubscription $строка): self
    {
        return new self($доступ, $основание, $строка);
    }

    /** Человеку понятная подпись основания. */
    public function подпись(): string
    {
        return self::ПОДПИСИ[$this->основание] ?? $this->основание;
    }

    /**
     * Что показывать как статус.
     *
     * `active` остаётся только там, где доступ действительно есть. Строка без
     * основания получает отдельное имя, иначе её снова прочтут как рабочую.
     */
    public function статус(): string
    {
        if ($this->строка === null) {
            return self::НЕТ_СТРОКИ;
        }

        if ($this->доступ) {
            return 'active';
        }

        if ($this->основание === self::БЕЗ_ОСНОВАНИЯ) {
            return 'no_basis';
        }

        if ($this->строка->status === 'active' && $this->строка->ends_at?->isPast()) {
            return 'expired';
        }

        return (string) $this->строка->status;
    }

    /** @return array<string, mixed>|null */
    public function toArray(): ?array
    {
        if ($this->строка === null && $this->основание === self::НЕТ_СТРОКИ) {
            return null;
        }

        return [
            'status' => $this->статус(),
            // Прежнее имя поля сохранено: его читают админка и тесты. Но
            // значение теперь означает «доступ открыт», а не «в строке
            // написано active» — в этом и была вся разница.
            'is_active' => $this->доступ,
            'access_basis' => $this->основание,
            'access_basis_label' => $this->подпись(),
            'ends_at' => $this->строка?->ends_at?->toIso8601String(),
            'auto_renew' => (bool) ($this->строка?->auto_renew ?? false),
        ];
    }
}
