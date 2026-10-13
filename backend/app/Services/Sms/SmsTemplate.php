<?php

namespace App\Services\Sms;

/**
 * Согласованные с МТС тексты SMS (имя отправителя MODELIZM).
 *
 * @see docs/sms/mts-approved-templates.md
 */
enum SmsTemplate: string
{
    /** Регистрация / верификация */
    case Verification = 'verification';
    /** Вход по SMS-коду */
    case Login = 'login';
    /** Восстановление пароля */
    case PasswordReset = 'password_reset';
    /** Смена / привязка нового номера */
    case PhoneChange = 'phone_change';
    /** Верификация перед публикацией объявления */
    case AdPublishVerify = 'ad_publish_verify';
    /** Объявление опубликовано */
    case AdPublished = 'ad_published';
    /** Объявление не прошло модерацию */
    case AdRejected = 'ad_rejected';
    /** Оплата размещения объявления */
    case AdPaymentReceived = 'ad_payment_received';
    /** Истекает размещение объявления */
    case AdExpiring = 'ad_expiring';
    /** Новое сообщение в чате */
    case ChatMessage = 'chat_message';
    /** Заявка в сообщество одобрена */
    case CommunityApproved = 'community_approved';
    /** Подписка активна до даты */
    case SubscriptionActive = 'subscription_active';
    /** Оплата подписки */
    case SubscriptionPaid = 'subscription_paid';
    /** Подписка истекает */
    case SubscriptionExpiring = 'subscription_expiring';
    /** Безопасная сделка — оплата покупателем */
    case DealPaymentBuyer = 'deal_payment_buyer';
    /** Безопасная сделка — продавцу об оплате */
    case DealPaymentSeller = 'deal_payment_seller';
    /** Заказ отправлен */
    case OrderShipped = 'order_shipped';
    /** Получение заказа подтверждено */
    case OrderReceived = 'order_received';
    /** Выплата продавцу */
    case SellerPayout = 'seller_payout';
    /** Возврат по заказу */
    case OrderRefund = 'order_refund';
    /** Новый отзыв */
    case NewReview = 'new_review';
    /** Реферальная программа */
    case ReferralReward = 'referral_reward';
    /** Онбординг после регистрации */
    case Welcome = 'welcome';
    /** Неоконченное объявление */
    case DraftReminder = 'draft_reminder';
    /** Вход с нового устройства */
    case NewDeviceLogin = 'new_device_login';
    /** Рекламное — промо запуска */
    case PromoLaunch = 'promo_launch';
    /** Рекламное — подписка */
    case PromoSubscription = 'promo_subscription';
    /** Рекламное — имиджевое */
    case PromoBrand = 'promo_brand';

    /**
     * У кодов подтверждения стоит `%s`, а не `%d`.
     *
     * Текст от этого не меняется, а ведущие нули перестают теряться. До 09.10
     * пять шаблонов с кодом держали `%d`, и `vsprintf` печатал число: код
     * `001234` уезжал в SMS как «1234». Подробный разбор — в
     * `PhoneVerificationService::sendCode()`.
     *
     * `%d` остаётся у рублей, номеров заказов и счётчиков — там это числа и
     * ведущих нулей у них не бывает.
     *
     * @param  array<int, int|string>  $params  Порядок параметров как в согласованном шаблоне (%d, %s, %w).
     */
    public function render(array $params = []): string
    {
        $template = match ($this) {
            /*
             * Код — строкой (%s), шесть цифр с ведущими нулями.
             *
             * Нельзя использовать формулировку «XXXX — ваш код для доступа к
             * сервису»: у операторов и СМС Дисконт это отдельный канал
             * мобильной авторизации с **четырьмя** цифрами и без бренда.
             * Текст с такой фразой подменяется, человек видит «1868…», а в
             * базе лежит шестизначный код — совпадения нет.
             *
             * @see docs/sms/mts-approved-templates.md
             */
            self::Verification => 'Modelizm: код подтверждения %s. Никому не сообщайте код.',
            self::Login => 'Modelizm: код для входа %s. Действует 5 минут.',
            self::PasswordReset => 'Modelizm: код восстановления пароля %s.',
            self::PhoneChange => 'Modelizm: код подтверждения нового номера %s.',
            self::AdPublishVerify => 'Modelizm: для публикации объявления введите код %s.',
            self::AdPublished => 'Modelizm: объявление «%s» опубликовано. modelizmclub.ru',
            self::AdRejected => 'Modelizm: объявление «%s» не прошло модерацию. modelizmclub.ru',
            self::AdPaymentReceived => 'Modelizm: оплата размещения «%s» — %d ₽ получена.',
            self::AdExpiring => 'Modelizm: размещение «%s» истекает %s. Продлить: modelizmclub.ru',
            self::ChatMessage => 'Modelizm: новое сообщение от %s. modelizmclub.ru',
            self::CommunityApproved => 'Modelizm: заявка в «%s» одобрена. modelizmclub.ru',
            self::SubscriptionActive => 'Modelizm: подписка «%s» активна до %s. modelizmclub.ru',
            self::SubscriptionPaid => 'Modelizm: оплата подписки %d ₽ получена. Действует до %s.',
            self::SubscriptionExpiring => 'Modelizm: подписка истекает %s. Продлить: modelizmclub.ru',
            self::DealPaymentBuyer => 'Modelizm: оплата %d ₽ по сделке №%d получена. Средства защищены.',
            self::DealPaymentSeller => 'Modelizm: по «%s» оплата %d ₽. Отправьте товар: modelizmclub.ru',
            self::OrderShipped => 'Modelizm: заказ №%d отправлен. Трек: %s',
            self::OrderReceived => 'Modelizm: получение заказа №%d подтверждено. %d ₽ — продавцу.',
            self::SellerPayout => 'Modelizm: %d ₽ за заказ №%d переведены на вашу карту.',
            self::OrderRefund => 'Modelizm: по заказу №%d возврат. %d ₽ вернутся на карту.',
            self::NewReview => 'Modelizm: новый отзыв по «%s». Читать: modelizmclub.ru',
            self::ReferralReward => 'Modelizm: друг %s пришёл по вашей ссылке. Награда: %s.',
            self::Welcome => 'Modelizm: добро пожаловать! Заполните профиль: modelizmclub.ru',
            self::DraftReminder => 'Modelizm: у вас неоконченное объявление. modelizmclub.ru',
            self::NewDeviceLogin => 'Modelizm: вход с нового устройства. Если не вы — смените пароль.',
            self::PromoLaunch => 'Реклама: Modelizm — 100 первым подписка бесплатно. Осталось %d мест.',
            self::PromoSubscription => 'Реклама: Modelizm — «Выгодно на год» от %d ₽/мес: modelizmclub.ru',
            self::PromoBrand => 'Реклама: Modelizm — сообщество моделистов России. modelizmclub.ru',
        };

        if ($params === []) {
            return $template;
        }

        return vsprintf($template, $params);
    }
}
