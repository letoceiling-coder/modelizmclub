<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\User;
use App\Support\PaymentFailure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\PaymentFulfillmentService;
use Tests\TestCase;

/**
 * Платёж говорит, почему не состоялся, а воронка не врёт.
 *
 * ЧТО БЫЛО. У всех 54 настоящих отказов в боевой базе лежала одна и та же
 * фраза, написанная нами: «Сверка: банк сообщил об отмене заказа».
 * Отличить «человек закрыл форму» от «банк отказал» было нечем, а сами
 * коды банка (`actionCode`) не читались нигде — поиск по корню слова по
 * всему `backend/app` давал ноль вхождений.
 *
 * ТРИ ИСХОДА, которые обязаны различаться: оплачено, отказ карты,
 * брошенная форма. Каждый со своим статусом и своей причиной.
 */
class PaymentFailureDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    private function человек(): User
    {
        return User::factory()->create([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $поля */
    private function платёж(User $user, array $поля = []): Payment
    {
        return Payment::query()->create(array_merge([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'status' => 'pending',
            'provider' => 'vtb',
            'provider_payment_id' => 'order-'.Str::random(8),
            'metadata' => ['payable_type' => 'subscription'],
        ], $поля));
    }

    public function test_исход_первый_оплачено(): void
    {
        $user = $this->человек();
        $p = $this->платёж($user);

        app(PaymentFulfillmentService::class)->markPaid($p, 'order-1');

        $p->refresh();
        $this->assertSame('paid', $p->status);
        $this->assertNull($p->failure_code, 'у успешной оплаты не должно быть причины отказа');
        $this->assertNotNull($p->paid_at);
    }

    public function test_исход_второй_отказ_карты(): void
    {
        $user = $this->человек();
        $p = $this->платёж($user);

        app(PaymentFulfillmentService::class)->markFailed(
            $p, 'Банк отклонил операцию.', 'insufficient_funds',
            'Недостаточно средств на карте', PaymentFailure::STAGE_BANK, PaymentFailure::BY_CALLBACK,
        );

        $p->refresh();
        $this->assertSame('failed', $p->status);
        $this->assertSame('insufficient_funds', $p->failure_code);
        $this->assertSame('Недостаточно средств на карте', $p->failure_message, 'текст банка не сохранён дословно');
        $this->assertSame(PaymentFailure::STAGE_BANK, $p->failure_stage);
        $this->assertSame(PaymentFailure::BY_CALLBACK, $p->decided_by);
        $this->assertNotNull($p->failed_at, 'без времени отказа воронка не посчитает длительность');
    }

    public function test_исход_третий_форма_брошена(): void
    {
        /*
         * Главное различие. Брошенная форма не отказ: банк этого платежа
         * не видел. Свалив её в `failed`, воронка утверждала бы, что банк
         * отклоняет почти всё.
         */
        $user = $this->человек();
        $p = $this->платёж($user);

        app(PaymentFulfillmentService::class)->markAbandoned(
            $p, 'Сверка: заказ истёк, оплата не начиналась.',
            PaymentFailure::STAGE_FORM, PaymentFailure::BY_RECONCILE,
        );

        $p->refresh();
        $this->assertSame('abandoned', $p->status, 'брошенная форма попала в отказы');
        $this->assertSame('abandoned', $p->failure_code);
        $this->assertSame(PaymentFailure::STAGE_FORM, $p->failure_stage);
    }

    public function test_код_банка_переводится_в_наш(): void
    {
        // Шестёрка `orderStatus` покрывает и то и другое; различает код.
        $this->assertSame('expired', PaymentFailure::fromVtbActionCode(-2007));
        $this->assertSame('insufficient_funds', PaymentFailure::fromVtbActionCode(116));
        $this->assertSame('none', PaymentFailure::fromVtbActionCode(0));
        $this->assertSame('unknown', PaymentFailure::fromVtbActionCode(null));
    }

    public function test_оплаченный_платёж_не_переписывается_отказом(): void
    {
        // Сверка может прийти после колбэка. Выдача уже состоялась.
        $user = $this->человек();
        $p = $this->платёж($user, ['status' => 'paid', 'paid_at' => now()]);

        app(PaymentFulfillmentService::class)->markFailed($p, 'Сверка: отмена.', 'declined_by_bank', null, PaymentFailure::STAGE_BANK);
        app(PaymentFulfillmentService::class)->markAbandoned($p, 'Сверка: истёк.', PaymentFailure::STAGE_FORM);

        $this->assertSame('paid', $p->fresh()->status);
    }

    public function test_отметка_о_форме_ставится_один_раз(): void
    {
        $user = $this->человек();
        $p = $this->платёж($user);

        $this->actingAs($user, 'sanctum')->postJson("/api/v1/payments/{$p->uuid}/form-opened")->assertOk();
        $первая = $p->fresh()->form_opened_at;
        $this->assertNotNull($первая);

        $this->travel(5)->minutes();
        $this->actingAs($user, 'sanctum')->postJson("/api/v1/payments/{$p->uuid}/form-opened")->assertOk();

        $this->assertEquals($первая, $p->fresh()->form_opened_at, 'повторный переход сдвинул время первого');
    }

    public function test_чужой_платёж_отметить_нельзя(): void
    {
        $хозяин = $this->человек();
        $p = $this->платёж($хозяин);
        $чужой = $this->человек();

        $this->actingAs($чужой, 'sanctum')
            ->postJson("/api/v1/payments/{$p->uuid}/form-opened")
            ->assertNotFound();
        $this->assertNull($p->fresh()->form_opened_at);

        /*
         * Контроль в той же проверке. Без него «чужому 404» означало бы и
         * «маршрута нет вовсе» — на коде без правки она проходила именно
         * так, ничего не проверяя.
         */
        $this->actingAs($хозяин, 'sanctum')
            ->postJson("/api/v1/payments/{$p->uuid}/form-opened")
            ->assertOk();
        $this->assertNotNull($p->fresh()->form_opened_at);
    }

    public function test_воронка_считает_шаги_и_причины(): void
    {
        $user = $this->человек();
        $s = app(PaymentFulfillmentService::class);

        $оплачен = $this->платёж($user);
        $this->actingAs($user, 'sanctum')->postJson("/api/v1/payments/{$оплачен->uuid}/form-opened");
        $s->markPaid($оплачен, 'order-ok');

        $отказ = $this->платёж($user);
        $this->actingAs($user, 'sanctum')->postJson("/api/v1/payments/{$отказ->uuid}/form-opened");
        $s->markFailed($отказ, 'Отказ.', 'insufficient_funds', 'нет денег', PaymentFailure::STAGE_BANK, PaymentFailure::BY_CALLBACK);

        $брошен = $this->платёж($user);
        $s->markAbandoned($брошен, 'Истёк.', PaymentFailure::STAGE_FORM, PaymentFailure::BY_RECONCILE);

        $d = $this->actingAs($this->owner(), 'sanctum')
            ->getJson('/api/v1/admin/payments/funnel')
            ->assertOk()
            ->json('data');

        $шаг = fn (string $k) => collect($d['steps'])->firstWhere('key', $k)['count'];
        $исход = fn (string $k) => collect($d['outcomes'])->firstWhere('key', $k)['count'];

        $this->assertSame(3, $шаг('started'));
        $this->assertSame(2, $шаг('form'), 'до формы дошли двое из трёх');
        $this->assertSame(1, $шаг('paid'));
        $this->assertSame(1, $исход('failed'));
        $this->assertSame(1, $исход('abandoned'), 'брошенная форма смешана с отказами');

        $причины = collect($d['reasons'])->pluck('count', 'code')->all();
        $this->assertSame(['insufficient_funds' => 1], $причины, 'в причинах отказа оказалась брошенная форма');
    }

    public function test_заглушка_в_воронку_не_попадает(): void
    {
        /*
         * Тестовый контур ставит «оплачено» без банка: на 30.09 таких 39
         * из 46 «оплат». Смешав их с настоящими, воронка показала бы
         * благополучие, которого нет.
         */
        $user = $this->человек();
        $this->платёж($user, ['provider' => Payment::STUB_PROVIDER, 'status' => 'paid', 'paid_at' => now()]);
        $this->платёж($user);

        $d = $this->actingAs($this->owner(), 'sanctum')
            ->getJson('/api/v1/admin/payments/funnel')
            ->assertOk()
            ->json('data');

        $this->assertSame(1, collect($d['steps'])->firstWhere('key', 'started')['count']);
        $this->assertSame(0, collect($d['outcomes'])->firstWhere('key', 'paid')['count']);
        $this->assertTrue($d['excludes_stub']);
    }

    public function test_воронка_отбирается_периодом(): void
    {
        $user = $this->человек();
        $старый = $this->платёж($user);
        $старый->forceFill(['created_at' => now()->subDays(40)])->save();
        $this->платёж($user);

        $за30 = $this->actingAs($this->owner(), 'sanctum')
            ->getJson('/api/v1/admin/payments/funnel?from='.now()->subDays(30)->toDateString())
            ->assertOk()->json('data.steps.0.count');

        $всё = $this->actingAs($this->owner(), 'sanctum')
            ->getJson('/api/v1/admin/payments/funnel')
            ->assertOk()->json('data.steps.0.count');

        $this->assertSame(1, $за30);
        $this->assertSame(2, $всё, 'без периода должны считаться обе');
    }

    public function test_воронка_только_владельцу(): void
    {
        $moderator = User::factory()->create([
            'role' => UserRole::Moderator, 'status' => UserStatus::Active, 'email_verified_at' => now(),
        ]);

        $this->actingAs($moderator, 'sanctum')->getJson('/api/v1/admin/payments/funnel')->assertForbidden();
    }
}
