<?php

namespace App\Enums;

/**
 * Wallet ledger movement types (spec v4.0 §1.1).
 * Positive amounts credit the balance, negative amounts debit it.
 */
enum WalletTransactionType: string
{
    case Topup = 'topup';
    case Subscription = 'subscription';
    case ListingPlacement = 'listing_placement';
    case SafeDealHold = 'safe_deal_hold';
    case SafeDealRelease = 'safe_deal_release';
    case SafeDealCommission = 'safe_deal_commission';
    case SafeDealRefund = 'safe_deal_refund';
    case SafeDealPayout = 'safe_deal_payout';
    case ReferralBonus = 'referral_bonus';
    case PromoBonus = 'promo_bonus';
    case Withdrawal = 'withdrawal';
    case WithdrawalRefund = 'withdrawal_refund';

    public function label(): string
    {
        return match ($this) {
            self::Topup => 'Пополнение баланса',
            self::Subscription => 'Оплата подписки',
            self::ListingPlacement => 'Размещение объявления',
            self::SafeDealHold => 'Холд по безопасной сделке',
            self::SafeDealRelease => 'Выплата по безопасной сделке',
            self::SafeDealCommission => 'Комиссия платформы',
            self::SafeDealRefund => 'Возврат по безопасной сделке',
            self::SafeDealPayout => 'Зачисление продавцу',
            self::ReferralBonus => 'Реферальный бонус',
            self::PromoBonus => 'Промо-бонус',
            self::Withdrawal => 'Вывод средств',
            self::WithdrawalRefund => 'Возврат вывода средств',
        };
    }

    /** Direction hint for UI: credit (+) or debit (-). */
    public function isCredit(): bool
    {
        return in_array($this, [
            self::Topup,
            self::SafeDealRelease,
            self::SafeDealPayout,
            self::SafeDealRefund,
            self::ReferralBonus,
            self::PromoBonus,
            self::WithdrawalRefund,
        ], true);
    }
}
