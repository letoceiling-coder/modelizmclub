<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Вебхук выплат требует общий секрет.
 *
 * До 03.10 подписи у него не было, а `advance()` вызывает
 * `confirmTransaction()` — подтверждение выплаты продавцу в банке. Защитой
 * служила только случайность `request_id`, то есть по совпадению, а не по
 * замыслу: при утечке идентификатора в логи или переписку адрес становился
 * кнопкой «подтвердить выплату» без всякого входа.
 *
 * Закрытый адрес выплаты не стопорит: их двигает `safe-deals:auto-release`
 * каждые 15 минут.
 */
class SafeDealPayoutWebhookSecretTest extends TestCase
{
    use RefreshDatabase;

    private const PAYLOAD = ['requestId' => 'd3b07384-d9a0-4f1b-9f0e-000000000001'];

    public function test_the_address_is_closed_when_the_secret_is_not_configured(): void
    {
        config(['billing.safe_deal.payout_webhook_secret' => '']);

        $this->postJson('/api/v1/safe-deals/webhooks/vtb-payout', self::PAYLOAD)
            ->assertStatus(404);
    }

    public function test_a_wrong_secret_is_refused(): void
    {
        config(['billing.safe_deal.payout_webhook_secret' => 'правильный']);

        $this->postJson('/api/v1/safe-deals/webhooks/vtb-payout', self::PAYLOAD, [
            'X-Payout-Signature' => 'неправильный',
        ])->assertStatus(401);
    }

    public function test_a_missing_header_is_refused(): void
    {
        config(['billing.safe_deal.payout_webhook_secret' => 'правильный']);

        $this->postJson('/api/v1/safe-deals/webhooks/vtb-payout', self::PAYLOAD)
            ->assertStatus(401);
    }

    public function test_the_right_secret_reaches_the_handler(): void
    {
        config(['billing.safe_deal.payout_webhook_secret' => 'правильный']);

        // Выплаты с таким `requestId` нет, поэтому обработчик отвечает
        // `ignored` — но это уже он, а не страж.
        $this->postJson('/api/v1/safe-deals/webhooks/vtb-payout', self::PAYLOAD, [
            'X-Payout-Signature' => 'правильный',
        ])->assertOk()->assertJsonPath('status', 'ignored');
    }
}
