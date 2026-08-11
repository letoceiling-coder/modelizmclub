<?php

/**
 * E2E VTB escrow flow + money movement report.
 *
 * Usage:
 *   php deploy/scripts/e2e-vtb-escrow-report.php [--wait=120] [--escrow-uuid=...] [--delivery-cents=0]
 *
 * Requires: escrow enabled, VTB credentials, API reachable at APP_URL.
 */
declare(strict_types=1);

require __DIR__.'/../../backend/vendor/autoload.php';
$app = require __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Enums\DeliveryCarrier;
use App\Enums\EscrowDealStatus;
use App\Enums\ListingStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Models\EscrowDeal;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Shipment;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\EscrowFeeCalculator;
use Modules\Billing\Services\EscrowService;
use Modules\Billing\Services\EscrowShipmentSync;
use Modules\Billing\Services\VtbEscrowService;
use Modules\Billing\Support\VtbCallbackChecksumValidator;

$opts = getopt('', ['wait::', 'escrow-uuid::', 'delivery-cents::', 'item-cents::']);
$waitSeconds = (int) ($opts['wait'] ?? 0);
$existingEscrowUuid = $opts['escrow-uuid'] ?? null;
$deliveryCents = (int) ($opts['delivery-cents'] ?? 0);
$itemCents = (int) ($opts['item-cents'] ?? 150_000);

$apiBase = rtrim((string) config('app.url'), '/').'/api/v1';
$report = [
    'started_at' => now()->toIso8601String(),
    'environment' => app()->environment(),
    'provider' => config('billing.provider'),
    'vtb_escrow_mode' => config('billing.vtb.escrow_mode'),
    'steps' => [],
    'money' => [],
    'errors' => [],
];

function step(array &$report, string $name, string $status, array $data = []): void
{
    $report['steps'][] = array_merge([
        'step' => $name,
        'status' => $status,
        'at' => now()->toIso8601String(),
    ], $data);
    echo sprintf("[%s] %s\n", strtoupper($status), $name);
    if ($data !== []) {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n";
    }
}

function rub(int $cents): string
{
    return number_format($cents / 100, 2, '.', ' ').' ₽';
}

function apiLogin(string $apiBase, string $email, string $password): ?string
{
    $resp = Http::post("{$apiBase}/auth/login", [
        'email' => $email,
        'password' => $password,
    ]);

    if (! $resp->successful()) {
        return null;
    }

    return $resp->json('meta.token');
}

function apiJson(string $method, string $url, ?string $token = null, array $body = []): array
{
    $req = Http::withHeaders($token ? ['Authorization' => "Bearer {$token}"] : []);
    $resp = match (strtoupper($method)) {
        'GET' => $req->get($url, $body),
        'POST' => $req->post($url, $body),
        default => throw new InvalidArgumentException("Unsupported method {$method}"),
    };

    return [
        'status' => $resp->status(),
        'json' => $resp->json(),
        'body' => $resp->body(),
    ];
}

function moneySnapshot(EscrowDeal $deal, EscrowFeeCalculator $calc): array
{
    $quote = $calc->quote($deal->item_amount_cents, $deal->delivery_amount_cents);

    return [
        'escrow_uuid' => $deal->uuid,
        'deal_status' => $deal->status->value,
        'listing_title' => $deal->listing?->title,
        'item_cents' => $deal->item_amount_cents,
        'item_rub' => rub($deal->item_amount_cents),
        'delivery_cents' => $deal->delivery_amount_cents,
        'delivery_rub' => rub($deal->delivery_amount_cents),
        'buyer_pays_total_cents' => $deal->amount_cents,
        'buyer_pays_total_rub' => rub($deal->amount_cents),
        'platform_fee_cents' => $deal->platform_fee_cents,
        'platform_fee_rub' => rub($deal->platform_fee_cents),
        'seller_payout_cents' => $deal->seller_payout_cents,
        'seller_payout_rub' => rub($deal->seller_payout_cents),
        'fee_mode' => $quote['fee_mode'],
        'captured_cents' => $deal->captured_cents,
        'captured_rub' => rub($deal->captured_cents),
        'paid_out_cents' => $deal->paid_out_cents,
        'paid_out_rub' => rub($deal->paid_out_cents),
        'refunded_cents' => $deal->refunded_cents,
        'vtb_order_id' => $deal->vtb_order_id,
        'vtb_mode' => is_array($deal->metadata) ? ($deal->metadata['vtb_mode'] ?? null) : null,
        'fee_snapshot' => $deal->fee_snapshot,
    ];
}

/** @return array{0: User, 1: User, 2: Listing} */
function ensureActors(int $itemCents): array
{
    $seller = User::query()->firstOrCreate(
        ['email' => 'escrow-e2e-seller@modelizmclub.ru'],
        ['password' => bcrypt('password123'), 'status' => UserStatus::Active],
    );
    UserProfile::query()->firstOrCreate(
        ['user_id' => $seller->id],
        [
            'display_name' => 'E2E Escrow Seller',
            'slug' => 'e2e-escrow-seller',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ],
    );

    $buyer = User::query()->firstOrCreate(
        ['email' => 'escrow-e2e-buyer@modelizmclub.ru'],
        ['password' => bcrypt('password123'), 'status' => UserStatus::Active],
    );
    UserProfile::query()->firstOrCreate(
        ['user_id' => $buyer->id],
        [
            'display_name' => 'E2E Escrow Buyer',
            'slug' => 'e2e-escrow-buyer',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ],
    );

    $category = ListingCategory::query()->firstOrCreate(
        ['slug' => 'escrow-e2e'],
        ['name' => 'Escrow E2E', 'sort_order' => 998],
    );

    $listing = Listing::query()
        ->where('user_id', $seller->id)
        ->where('status', ListingStatus::Published)
        ->where('price_cents', $itemCents)
        ->first();

    if (! $listing) {
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'E2E VTB Escrow — модель 1:48',
            'slug' => 'e2e-vtb-escrow-'.Str::lower(Str::random(6)),
            'description' => 'Тестовое объявление для полного цикла безопасной сделки VTB.',
            'price_cents' => $itemCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
            'delivery_methods' => ['pickup'],
        ]);
    }

    return [$seller, $buyer, $listing];
}

function payVtbSandboxCard(string $orderId): array
{
    $token = config('billing.vtb.token');
    $params = $token
        ? ['token' => $token]
        : [
            'userName' => (string) config('billing.vtb.username'),
            'password' => (string) config('billing.vtb.password'),
        ];

    $resp = Http::asForm()->timeout(60)->post(
        rtrim((string) config('billing.vtb.api_url'), '/').'/paymentorder.do',
        array_merge($params, [
            'MDORDER' => $orderId,
            '$PAN' => '4111111111111111',
            '$CVC' => '123',
            'YYYY' => '2030',
            'MM' => '12',
            'TEXT' => 'TEST CARDHOLDER',
            'language' => 'ru',
        ]),
    );

    return [
        'http' => $resp->status(),
        'body' => $resp->json() ?? $resp->body(),
    ];
}

function fireVtbCallback(string $orderId, string $orderNumber, string $operation = 'deposited'): void
{
    $token = (string) config('billing.vtb.callback_token');
    if ($token === '') {
        return;
    }

    $params = [
        'mdOrder' => $orderId,
        'orderNumber' => $orderNumber,
        'operation' => $operation,
        'status' => '1',
    ];
    $validator = new VtbCallbackChecksumValidator($token);
    $params['checksum'] = $validator->compute($params);

    Http::asForm()->post(rtrim((string) config('app.url'), '/').'/api/v1/payments/webhooks/vtb', $params);
}

function cancelPendingDeals(Listing $listing): void
{
    EscrowDeal::query()
        ->where('listing_id', $listing->id)
        ->where('status', EscrowDealStatus::PendingPayment)
        ->update(['status' => EscrowDealStatus::Cancelled]);
}

function simulateShipping(EscrowDeal $deal): EscrowDeal
{
    $shipment = $deal->shipment;

    if (! $shipment) {
        $shipment = Shipment::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $deal->listing_id,
            'seller_id' => $deal->seller_id,
            'buyer_id' => $deal->buyer_id,
            'provider' => DeliveryCarrier::Cdek,
            'status' => ShipmentStatus::Created,
            'delivery_cost_cents' => $deal->delivery_amount_cents,
            'currency' => $deal->currency,
            'weight_kg' => 1.0,
            'destination_point' => ['label' => 'E2E test PVZ'],
            'tracking_number' => 'E2E-'.Str::upper(Str::random(8)),
        ]);
        $deal->update(['shipment_id' => $shipment->id]);
    }

    $sync = app(EscrowShipmentSync::class);

    foreach ([ShipmentStatus::InTransit, ShipmentStatus::Delivered] as $status) {
        $shipment->update([
            'status' => $status,
            'delivered_at' => $status === ShipmentStatus::Delivered ? now() : null,
        ]);
        $sync->onShipmentUpdated($shipment->fresh());
    }

    return $deal->fresh(['listing', 'shipment']);
}

try {
    $feeCalc = app(EscrowFeeCalculator::class);
    $escrowService = app(EscrowService::class);
    $vtbEscrow = app(VtbEscrowService::class);

    if ($existingEscrowUuid) {
        $deal = EscrowDeal::query()->where('uuid', $existingEscrowUuid)->firstOrFail();
        step($report, 'resume_existing_deal', 'ok', ['escrow_uuid' => $deal->uuid, 'status' => $deal->status->value]);
    } else {
        [$seller, $buyer, $listing] = ensureActors($itemCents);
        cancelPendingDeals($listing);
        step($report, 'actors_ready', 'ok', [
            'seller_email' => $seller->email,
            'buyer_email' => $buyer->email,
            'listing_uuid' => $listing->uuid,
            'item_cents' => $itemCents,
            'item_rub' => rub($itemCents),
        ]);

        $buyerToken = apiLogin($apiBase, $buyer->email, 'password123');
        if (! $buyerToken) {
            throw new RuntimeException('Buyer login failed');
        }
        step($report, 'buyer_login', 'ok');

        $quoteResp = apiJson('GET', "{$apiBase}/escrow/quote", null, [
            'listing_uuid' => $listing->uuid,
            'delivery_cents' => $deliveryCents,
        ]);
        $quote = $quoteResp['json']['data'] ?? [];
        step($report, 'fee_quote', $quoteResp['status'] === 200 ? 'ok' : 'fail', $quote);

        $checkoutResp = apiJson('POST', "{$apiBase}/listings/{$listing->uuid}/escrow/checkout", $buyerToken, [
            'delivery_amount_cents' => $deliveryCents,
        ]);

        if ($checkoutResp['status'] !== 201) {
            throw new RuntimeException('Checkout failed: '.$checkoutResp['body']);
        }

        $checkout = $checkoutResp['json']['data'] ?? [];
        $deal = EscrowDeal::query()->where('uuid', $checkout['escrow_uuid'])->firstOrFail();
        step($report, 'escrow_checkout', 'ok', [
            'escrow_uuid' => $deal->uuid,
            'checkout_url' => $checkout['checkout_url'] ?? null,
            'vtb_order_id' => $deal->vtb_order_id,
        ]);

        $report['money']['at_checkout'] = moneySnapshot($deal, $feeCalc);

        // Auto-pay via VTB sandbox paymentorder.do (test card)
        if ($deal->status === EscrowDealStatus::PendingPayment && $deal->vtb_order_id) {
            $payResult = payVtbSandboxCard($deal->vtb_order_id);
            step($report, 'vtb_test_card_payment', ($payResult['http'] ?? 0) === 200 ? 'ok' : 'warn', $payResult);

            fireVtbCallback(
                $deal->vtb_order_id,
                (string) ($deal->payment?->uuid ?? $deal->uuid),
                'deposited',
            );

            $vtbEscrow->syncDeal($deal->fresh());
            $deal = $deal->fresh(['listing', 'payment', 'shipment']);
            step($report, 'post_payment_sync', 'ok', ['escrow_status' => $deal->status->value]);
        }

        if ($waitSeconds > 0 && $deal->status === EscrowDealStatus::PendingPayment && ($checkout['checkout_url'] ?? null)) {
            step($report, 'await_vtb_payment', 'pending', [
                'wait_seconds' => $waitSeconds,
                'instruction' => 'Оплатите checkout_url тестовой картой VTB sandbox',
                'checkout_url' => $checkout['checkout_url'],
            ]);

            $deadline = time() + $waitSeconds;
            while (time() < $deadline) {
                sleep(5);
                $vtbEscrow->syncDeal($deal->fresh());
                $deal = $deal->fresh(['listing', 'payment', 'shipment']);
                if ($deal->status !== EscrowDealStatus::PendingPayment) {
                    step($report, 'vtb_payment_detected', 'ok', ['status' => $deal->status->value]);
                    break;
                }
            }
        }
    }

    $deal = $deal->fresh(['listing', 'payment', 'shipment']);

    if ($deal->status === EscrowDealStatus::PendingPayment) {
        step($report, 'payment_required', 'blocked', [
            'message' => 'Сделка не оплачена. Запустите с --wait=180 или --escrow-uuid после оплаты.',
            'checkout_url' => $deal->payment?->metadata['checkout_url'] ?? null,
        ]);
        $report['money']['current'] = moneySnapshot($deal, $feeCalc);
        goto finish;
    }

    $report['money']['after_payment'] = moneySnapshot($deal, $feeCalc);

    // Seller ships
    $deal = simulateShipping($deal);
    step($report, 'seller_shipped', 'ok', [
        'shipment_status' => $deal->shipment?->status->value,
        'escrow_status' => $deal->status->value,
    ]);
    $report['money']['after_shipment'] = moneySnapshot($deal, $feeCalc);

    // Buyer confirms receipt
    $buyer = $deal->buyer;
    $deal = $escrowService->confirmReceipt($buyer, $deal->fresh(['listing', 'shipment', 'payment']));
    step($report, 'buyer_confirmed_receipt', 'ok', ['escrow_status' => $deal->status->value]);
    $report['money']['after_confirm'] = moneySnapshot($deal, $feeCalc);

    // Money movement ledger
    $m = $report['money']['after_confirm'];
    $report['money']['ledger'] = [
        '1_buyer_charged' => [
            'amount' => $m['buyer_pays_total_rub'],
            'breakdown' => [
                'item' => $m['item_rub'],
                'delivery' => $m['delivery_rub'],
            ],
            'destination' => 'VTB merchant account (modelizmclub)',
        ],
        '2_platform_retains' => [
            'amount' => $m['platform_fee_rub'],
            'note' => 'Комиссия площадки (удерживается из цены товара, не из доставки)',
            'fee_mode' => $m['fee_mode'],
        ],
        '3_seller_receives' => [
            'amount' => $m['seller_payout_rub'],
            'note' => 'Начисление в ledger (paid_out_cents). Фактический банковский перевод — вручную через admin payout.',
            'captured_to_merchant' => $m['captured_rub'],
        ],
        '4_vtb_acquiring' => [
            'note' => 'Комиссия эквайринга VTB — по тарифу мерчанта, в API не возвращается',
            'mode' => $m['vtb_mode'] ?? 'single',
        ],
        '5_delivery_carrier' => [
            'buyer_paid_delivery' => $m['delivery_rub'],
            'note' => 'Стоимость доставки включена в charge покупателя; перевод перевозчику — отдельный контур CDEK/Yandex',
        ],
    ];

    step($report, 'deal_completed', $deal->status === EscrowDealStatus::Completed ? 'ok' : 'warn', [
        'listing_status' => $deal->listing?->status->value,
    ]);

    finish:
} catch (Throwable $e) {
    $report['errors'][] = $e->getMessage();
    step($report, 'fatal', 'fail', ['error' => $e->getMessage()]);
}

$report['finished_at'] = now()->toIso8601String();

$outDir = dirname(__DIR__).'/../docs/qa';
if (! is_dir($outDir)) {
    mkdir($outDir, 0755, true);
}
$jsonPath = $outDir.'/vtb-escrow-e2e-report.json';
file_put_contents($jsonPath, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

$mdPath = $outDir.'/vtb-escrow-e2e-report.md';
$ledger = $report['money']['ledger'] ?? null;
$md = "# VTB Escrow E2E — отчёт о движении средств\n\n";
$md .= "**Дата:** {$report['finished_at']}\n\n";
$md .= "## Шаги\n\n| # | Шаг | Статус |\n|---|-----|--------|\n";
foreach ($report['steps'] as $i => $s) {
    $md .= '| '.($i + 1).' | '.($s['step'] ?? '').' | '.($s['status'] ?? '')." |\n";
}
if ($ledger) {
    $m = $report['money']['after_confirm'] ?? [];
    $md .= "\n## Движение денежных средств\n\n";
    $md .= "| Участник | Сумма | Комментарий |\n|----------|-------|-------------|\n";
    $md .= "| Покупатель → VTB | {$ledger['1_buyer_charged']['amount']} | товар {$ledger['1_buyer_charged']['breakdown']['item']} + доставка {$ledger['1_buyer_charged']['breakdown']['delivery']} |\n";
    $md .= "| Площадка (комиссия) | {$ledger['2_platform_retains']['amount']} | режим {$ledger['2_platform_retains']['fee_mode']} |\n";
    $md .= "| Продавец (к выплате) | {$ledger['3_seller_receives']['amount']} | captured {$ledger['3_seller_receives']['captured_to_merchant']} |\n";
    $md .= "| VTB эквайринг | — | {$ledger['4_vtb_acquiring']['note']} |\n";
    $md .= "| Доставка (перевозчик) | {$ledger['5_delivery_carrier']['buyer_paid_delivery']} | {$ledger['5_delivery_carrier']['note']} |\n";
    $md .= "\n### Итог\n\n";
    $md .= "- Цена товара: **{$m['item_rub']}**\n";
    $md .= "- Покупатель заплатил: **{$m['buyer_pays_total_rub']}**\n";
    $md .= "- Комиссия сервиса: **{$m['platform_fee_rub']}**\n";
    $md .= "- Продавцу: **{$m['seller_payout_rub']}**\n";
    $md .= "- Списано с VTB (captured): **{$m['captured_rub']}**\n";
    $md .= "- Начислено продавцу (ledger): **{$m['paid_out_rub']}**\n";
}
if (! empty($report['errors'])) {
    $md .= "\n## Ошибки\n\n".implode("\n", array_map(fn ($e) => "- {$e}", $report['errors']))."\n";
}
file_put_contents($mdPath, $md);

echo "\n=== REPORT SAVED: {$jsonPath} ===\n";
echo "=== MARKDOWN: {$mdPath} ===\n";
echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n";

exit(empty($report['errors']) && ($report['steps'][array_key_last($report['steps'])]['step'] ?? '') !== 'payment_required' ? 0 : 2);
