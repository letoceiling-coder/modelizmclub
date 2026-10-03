<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Support\PaymentFailure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Clients\VtbAcquiringClient;
use Modules\Billing\Clients\YooKassaClient;
use Tests\TestCase;

/**
 * Восстановление причины отказа по старым платежам ВТБ.
 *
 * На 01.10 у всех 54 настоящих отказов в боевой базе одна и та же
 * причина — фраза, которую написала наша же сверка. Код банка до 30.09
 * не читался нигде. Заказы в банке зарегистрированы, и банк до сих пор
 * отвечает по ним, — значит причину можно вернуть.
 *
 * Команда спрашивает банк и заполняет код, текст и шаг. Деньги она не
 * трогает: статус остаётся прежним, и это проверяется отдельно.
 */
class RecoverFailureReasonsTest extends TestCase
{
    use RefreshDatabase;

    private function платёж(array $patch = []): Payment
    {
        return Payment::query()->create(array_merge([
            'uuid' => Str::uuid()->toString(),
            'user_id' => User::factory()->create()->id,
            'amount_cents' => 10000,
            'currency' => 'RUB',
            'status' => 'failed',
            'provider' => 'vtb',
            'provider_payment_id' => 'ORDER-'.Str::random(6),
            'failure_stage' => PaymentFailure::STAGE_UNKNOWN,
            'failed_at' => now()->subDays(20),
        ], $patch));
    }

    /** @param array<string, array<string, mixed>> $ответы orderId → ответ банка */
    private function банкОтвечает(array $ответы, ?int &$обращений = null): void
    {
        $счётчик = 0;
        $this->app->instance(VtbAcquiringClient::class, new class($ответы, $счётчик) extends VtbAcquiringClient
        {
            public function __construct(private array $ответы, public int &$счётчик) {}

            public function getOrderStatusExtended(string $orderId): array
            {
                $this->счётчик++;

                if (! array_key_exists($orderId, $this->ответы)) {
                    throw new \RuntimeException("банк не знает заказ {$orderId}");
                }

                return $this->ответы[$orderId];
            }
        });
        $обращений = &$счётчик;
    }

    public function test_сухой_прогон_не_спрашивает_банк_и_не_пишет(): void
    {
        $платёж = $this->платёж();
        // Любое обращение к банку уронит подменённого клиента: ответов нет.
        $this->банкОтвечает([]);

        $this->artisan('payments:recover-reasons')
            ->expectsOutputToContain('Сухой прогон')
            ->assertSuccessful();

        $платёж->refresh();
        $this->assertNull($платёж->failure_code, 'сухой прогон записал причину');
        $this->assertSame(PaymentFailure::STAGE_UNKNOWN, $платёж->failure_stage);
    }

    public function test_причина_берётся_из_кода_банка(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => [
                'orderStatus' => 6,
                'actionCode' => 116,
                'actionCodeDescription' => 'Недостаточно средств на карте',
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('insufficient_funds', $платёж->failure_code);
        // Число банка хранится рядом со словом: таблица соответствий не
        // проверена против живого мерчанта, а прогон одноразовый.
        $this->assertSame('Недостаточно средств на карте [actionCode 116]', $платёж->failure_message);
        $this->assertSame(PaymentFailure::STAGE_BANK, $платёж->failure_stage);
        /*
         * `decided_by` не трогается: решение вынесли раньше, команда
         * восстанавливает только его причину. Переписывать «кто решил»
         * значило бы задним числом приписать решение этому прогону.
         */
        $this->assertNull($платёж->decided_by, 'переписано «кто вынес решение»');
        // Решение не пересматривается — меняется только его причина.
        $this->assertSame('failed', $платёж->status);
    }

    public function test_истёкший_срок_это_брошенная_форма_а_не_отказ_банка(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => [
                'orderStatus' => 6,
                'actionCode' => -2007,
                'actionCodeDescription' => 'Истёк срок заказа',
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('expired', $платёж->failure_code);
        $this->assertSame(
            PaymentFailure::STAGE_FORM,
            $платёж->failure_stage,
            'истёкший срок записан как отказ банка — банк такого платежа не видел',
        );
    }

    public function test_банк_говорит_оплачен_строка_пропускается(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => ['orderStatus' => 2, 'actionCode' => 0],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')
            ->expectsOutputToContain('разберите отдельно')
            ->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('failed', $платёж->status, 'расхождение по деньгам правлено пакетом');
        $this->assertNull($платёж->failure_code, 'причина записана поверх расхождения');
    }

    public function test_молчание_банка_не_останавливает_остальных(): void
    {
        $молчит = $this->платёж();
        $отвечает = $this->платёж();
        $this->банкОтвечает([
            $отвечает->provider_payment_id => [
                'orderStatus' => 6,
                'actionCode' => 119,
                'actionCodeDescription' => 'Отказ банка',
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')
            ->expectsOutputToContain('банк не ответил')
            ->assertSuccessful();

        $this->assertNull($молчит->fresh()->failure_code);
        $this->assertSame('declined_by_bank', $отвечает->fresh()->failure_code);
    }

    public function test_выборка_не_трогает_чужого(): void
    {
        $уже = $this->платёж(['failure_code' => 'declined_by_bank', 'failure_message' => 'было']);
        $оплачен = $this->платёж(['status' => 'paid']);
        // Заглушка и кошелёк — не провайдеры, спрашивать о них некого.
        // ЮKassa с 02.10 в разборе своя: её причина лежит в
        // `cancellation_details`, и ключи магазина живые.
        $чужой = $this->платёж(['provider' => 'stub']);
        $безЗаказа = $this->платёж(['provider_payment_id' => null]);

        $this->банкОтвечает([]);

        $this->artisan('payments:recover-reasons')
            ->expectsOutputToContain('Платежей без восстановимой причины нет')
            ->assertSuccessful();

        $this->assertSame('declined_by_bank', $уже->fresh()->failure_code, 'записанная причина перезаписана');
        $this->assertSame('paid', $оплачен->fresh()->status);
        $this->assertNull($чужой->fresh()->failure_code);
        $this->assertNull($безЗаказа->fresh()->failure_code);
    }

    public function test_брошенные_тоже_восстанавливаются(): void
    {
        // `abandoned` — тоже закрытый платёж без причины: у него код банка
        // может объяснить, форму закрыли или срок истёк.
        $платёж = $this->платёж(['status' => 'abandoned']);
        $this->банкОтвечает([
            $платёж->provider_payment_id => ['orderStatus' => 6, 'actionCode' => -2007],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $this->assertSame('expired', $платёж->fresh()->failure_code);
        $this->assertSame('abandoned', $платёж->fresh()->status);
    }

    public function test_банк_не_назвал_причину_строка_не_трогается(): void
    {
        foreach ([null, 0, 'DECLINED'] as $что) {
            $платёж = $this->платёж();
            $ответ = ['orderStatus' => 6];
            if ($что !== null) {
                $ответ['actionCode'] = $что;
            }
            $this->банкОтвечает([$платёж->provider_payment_id => $ответ]);

            $this->artisan('payments:recover-reasons --apply --delay-ms=0')
                ->expectsOutputToContain('банк причины не назвал')
                ->assertSuccessful();

            $платёж->refresh();
            /*
             * Не-ответ, записанный причиной, запер бы строку навсегда:
             * выборка берёт только пустой `failure_code`. Переспросить
             * её было бы нечем.
             */
            $this->assertNull($платёж->failure_code, 'записана причина, которой банк не называл: '.var_export($что, true));
            $this->assertSame(PaymentFailure::STAGE_UNKNOWN, $платёж->failure_stage);
        }
    }

    public function test_вложенный_ответ_банка_разбирается(): void
    {
        $платёж = $this->платёж();
        // Такая форма зафиксирована в tests/Unit/VtbAcquiringClientTest.
        $this->банкОтвечает([
            $платёж->provider_payment_id => [
                'orderStatus' => [
                    'orderStatus' => 6,
                    'actionCode' => 116,
                    'actionCodeDescription' => 'Недостаточно средств',
                ],
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('insufficient_funds', $платёж->failure_code, 'код во вложенном ответе не найден');
        $this->assertStringContainsString('Недостаточно средств', (string) $платёж->failure_message);
    }

    public function test_истёкшие_называются_поимённо(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => ['orderStatus' => 6, 'actionCode' => -2007],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')
            // Статус остаётся `failed`, и в воронке строка попадёт в
            // «Отказано» — об этом надо сказать, а не умолчать.
            ->expectsOutputToContain('перенесите в «брошено»')
            ->assertSuccessful();
    }

    /** @param array<string, array<string, mixed>> $ответы */
    private function юkassaОтвечает(array $ответы): void
    {
        $this->app->instance(YooKassaClient::class, new class($ответы) extends YooKassaClient
        {
            public function __construct(private array $ответы) {}

            public function getPayment(string $paymentId): array
            {
                if (! array_key_exists($paymentId, $this->ответы)) {
                    throw new \RuntimeException("ЮKassa не знает платёж {$paymentId}");
                }

                return $this->ответы[$paymentId];
            }
        });
    }

    public function test_юkassa_причина_берётся_из_cancellation_details(): void
    {
        $платёж = $this->платёж(['provider' => 'yookassa']);
        $this->банкОтвечает([]);
        $this->юkassaОтвечает([
            $платёж->provider_payment_id => [
                'status' => 'canceled',
                'cancellation_details' => ['party' => 'payment_network', 'reason' => 'insufficient_funds'],
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('insufficient_funds', $платёж->failure_code);
        $this->assertStringContainsString('reason insufficient_funds', (string) $платёж->failure_message);
        // Имя стороны сохраняется: наш код — пересказ, а пересказ может
        // оказаться неверным.
        $this->assertStringContainsString('party payment_network', (string) $платёж->failure_message);
        $this->assertSame(PaymentFailure::STAGE_BANK, $платёж->failure_stage);
        $this->assertSame('failed', $платёж->status);
    }

    public function test_юkassa_истёкший_срок_это_уход_с_формы(): void
    {
        $платёж = $this->платёж(['provider' => 'yookassa']);
        $this->банкОтвечает([]);
        $this->юkassaОтвечает([
            $платёж->provider_payment_id => [
                'status' => 'canceled',
                'cancellation_details' => ['party' => 'yoo_money', 'reason' => 'expired_on_confirmation'],
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $this->assertSame('expired', $платёж->fresh()->failure_code);
        $this->assertSame(PaymentFailure::STAGE_FORM, $платёж->fresh()->failure_stage);
    }

    public function test_юkassa_без_причины_строка_не_трогается(): void
    {
        $платёж = $this->платёж(['provider' => 'yookassa']);
        $this->банкОтвечает([]);
        $this->юkassaОтвечает([
            $платёж->provider_payment_id => ['status' => 'canceled'],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')
            ->expectsOutputToContain('причина не названа')
            ->assertSuccessful();

        $this->assertNull($платёж->fresh()->failure_code);
    }

    public function test_юkassa_неизвестное_имя_не_выдаётся_за_знакомое(): void
    {
        $платёж = $this->платёж(['provider' => 'yookassa']);
        $this->банкОтвечает([]);
        $this->юkassaОтвечает([
            $платёж->provider_payment_id => [
                'status' => 'canceled',
                'cancellation_details' => ['party' => 'merchant', 'reason' => 'something_new'],
            ],
        ]);

        $this->artisan('payments:recover-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('declined_other', $платёж->failure_code, 'незнакомая причина подогнана под знакомую');
        $this->assertStringContainsString('something_new', (string) $платёж->failure_message, 'имя причины потеряно');
    }

    public function test_сухой_прогон_называет_оба_провайдера(): void
    {
        $this->платёж(['provider' => 'vtb']);
        $this->платёж(['provider' => 'yookassa']);
        $this->банкОтвечает([]);

        /*
         * Прежняя версия печатала один запрос — ВТБ-овский — и писала
         * «запросов будет N» на всех. Половина уходила бы в ЮKassa,
         * другим адресом и другим телом. Сухой прогон затем и нужен,
         * чтобы человек увидел, что отправится на самом деле.
         */
        $this->artisan('payments:recover-reasons')
            ->expectsOutputToContain('ВТБ — 1 шт.')
            ->expectsOutputToContain('ЮKassa — 1 шт.')
            ->expectsOutputToContain('api.yookassa.ru')
            ->expectsOutputToContain('Всего запросов: 2')
            ->assertSuccessful();
    }

    public function test_песочница_названа_вслух(): void
    {
        config()->set('billing.vtb.api_url', 'https://vtb.rbsuat.com/payment/rest/');
        $this->платёж(['provider' => 'vtb']);
        $this->банкОтвечает([]);

        // Коды песочницы, записанные в боевые строки, хуже пустоты.
        $this->artisan('payments:recover-reasons')
            ->expectsOutputToContain('испытательный контур')
            ->assertSuccessful();
    }
}
