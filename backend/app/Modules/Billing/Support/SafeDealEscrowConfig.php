<?php

namespace Modules\Billing\Support;

use App\Models\SystemSetting;
use Illuminate\Validation\ValidationException;

/**
 * Где держатся деньги безопасной сделки: у банка или на кошельке площадки.
 *
 * До 07.09 значение приходило только из `SAFE_DEAL_ESCROW_PROVIDER` в
 * окружении. Смена провайдера — операционное решение (банк недоступен, идёт
 * приёмка, эквайринг ещё не подключён), а требовала правки .env и перезапуска
 * php-fpm на проде. Теперь оно живёт там же, где цены размещения: в
 * `system_settings`, пишется через AdminSettingsController с записью в аудит.
 *
 * Окружение осталось запасным значением, а не отменено: если строки в базе
 * нет, работает ровно то, что было. Поэтому выкатка ничего не меняет до
 * первого сохранения из админки.
 */
final class SafeDealEscrowConfig
{
    public const SETTING_KEY = 'safe_deal.escrow_provider';

    public const GROUP = 'billing';

    public const PROVIDER_VTB = 'vtb';

    public const PROVIDER_WALLET = 'wallet';

    /** Ни одно значение не выбрано — решает окружение и наличие настроек ВТБ. */
    public const MODE_AUTO = 'auto';

    /** @var list<string> Что разрешено сохранить из админки. */
    public const CHOICES = [self::PROVIDER_VTB, self::PROVIDER_WALLET];

    /**
     * Итоговый режим: настройка из админки, иначе окружение.
     *
     * Возвращает `auto`, когда не задано ни то ни другое — разбирать этот
     * случай (проверять, настроен ли ВТБ) должен вызывающий, здесь только
     * источник значения.
     */
    public static function mode(): string
    {
        return self::fromSetting() ?? (string) config('billing.safe_deal.escrow_provider', self::MODE_AUTO);
    }

    /** Значение из базы, если оно там есть и осмысленно. */
    public static function fromSetting(): ?string
    {
        $value = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $provider = is_array($value) ? ($value['provider'] ?? null) : null;

        return in_array($provider, self::CHOICES, true) ? $provider : null;
    }

    /**
     * Проверка значения перед записью.
     *
     * Настройка распоряжается деньгами покупателя, поэтому непонятное значение
     * отклоняется, а не приводится молча к умолчанию: тихая нормализация здесь
     * означала бы, что админ видит сохранение, а провайдер остался прежним.
     *
     * @return array{provider: string}
     *
     * @throws ValidationException
     */
    public static function normalize(mixed $value): array
    {
        $provider = is_array($value) ? ($value['provider'] ?? null) : $value;
        $provider = is_string($provider) ? strtolower(trim($provider)) : null;

        if (! in_array($provider, self::CHOICES, true)) {
            throw ValidationException::withMessages([
                'settings' => ['Провайдер безопасной сделки должен быть vtb или wallet.'],
            ]);
        }

        return ['provider' => $provider];
    }
}
