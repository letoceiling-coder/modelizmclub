<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\UserRealtimeEvent;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ModerationQueue;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Состояние объекта доезжает до владельца само, каким бы путём ни менялось.
 *
 * 21.09 живое обновление ставилось руками в двух местах — модерация и
 * уведомление по сделке. Статус объявления при этом меняют ещё оплата,
 * продажа, снятие резерва и правка из админки, и все эти пути оставляли
 * экран прежним до перезагрузки страницы.
 *
 * Проверяется поэтому не «модерация шлёт событие», а само правило: колонка
 * `status` изменилась — владелец узнал. Отдельно проверяется, что событие
 * уходит после фиксации транзакции: модерация и продажа работают в
 * транзакции, а вещание немедленное, и клиент, получивший «перечитай»
 * раньше времени, перечитал бы прежнее состояние.
 */
class RealtimeStatusUpdatesTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'U',
            'slug' => 'u-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function listingFor(User $seller, ListingStatus $status = ListingStatus::PendingModeration): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => $status,
        ]);

        ModerationQueue::query()->create([
            'moderatable_type' => Listing::class,
            'moderatable_id' => $listing->id,
            'queue' => 'listings',
            'priority' => 0,
            'status' => 'pending',
        ]);

        return $listing;
    }

    /**
     * События `object.updated`, ушедшие конкретному человеку.
     *
     * @return list<array{kind: string, uuid: string, status: string|null}>
     */
    private function updatesFor(User $user): array
    {
        return Event::dispatched(UserRealtimeEvent::class)
            ->map(fn (array $args): UserRealtimeEvent => $args[0])
            ->filter(fn (UserRealtimeEvent $e): bool => $e->userUuid === $user->uuid
                && $e->type === 'object.updated')
            ->map(fn (UserRealtimeEvent $e): array => [
                'kind' => $e->payload['kind'],
                'uuid' => $e->payload['uuid'],
                'status' => $e->payload['status'],
            ])
            ->values()
            ->all();
    }

    /**
     * Частичный дублёр — только `UserRealtimeEvent`.
     *
     * Полный `Event::fake()` здесь всё бы и сломал: наблюдатели живут на том
     * же диспетчере, и подменённый целиком он не донёс бы `eloquent.updated`
     * до проверяемого кода вовсе.
     */
    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([UserRealtimeEvent::class]);
    }

    public function test_moderation_decision_reaches_the_author(): void
    {
        $admin = $this->seedUser(UserRole::Owner);
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'published'])
            ->assertOk();

        $this->assertSame(
            [['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'published']],
            $this->updatesFor($seller),
        );
    }

    /**
     * Ради этого случая наблюдатель и заводился.
     *
     * Продажа обычной сделкой, снятие резерва, публикация после оплаты — ни
     * один из этих путей не проходит через модерацию, и ни один до 22.09
     * живого события не слал.
     */
    public function test_any_other_path_reaches_the_author_too(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        $listing->forceFill(['status' => ListingStatus::Sold, 'sold_at' => now()])->save();

        $this->assertSame(
            [['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'sold']],
            $this->updatesFor($seller),
        );
    }

    public function test_untouched_status_says_nothing(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        $listing->forceFill(['title' => 'Другое название'])->save();

        $this->assertSame([], $this->updatesFor($seller), 'правка названия — не смена состояния');
    }

    /**
     * Шаг сделки меняет одна сторона, а видеть его должны обе.
     *
     * До 22.09 событие уходило только тому, кому в этот момент писали в
     * колокольчик: вторая сторона смотрела на прежний шаг до перезагрузки.
     */
    public function test_both_sides_of_a_deal_learn_about_the_step(): void
    {
        $buyer = $this->seedUser();
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        $deal = SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'seller_payout_kopecks' => 95000,
            'currency' => 'RUB',
            'status' => SafeDealStatus::Created,
        ]);

        $deal->forceFill(['status' => SafeDealStatus::Paid, 'paid_at' => now()])->save();

        $expected = [['kind' => 'deal', 'uuid' => $deal->uuid, 'status' => 'paid']];
        $this->assertSame($expected, $this->updatesFor($buyer));
        $this->assertSame($expected, $this->updatesFor($seller));
    }

    /**
     * Два сохранения одной модели в одной транзакции дают одно событие.
     *
     * Так работают все три живых пути: владелец правит объявление (сначала
     * поля, потом возврат на модерацию), публикация записи и разбор платежа,
     * где объявление сохраняется трижды.
     *
     * Готовый `ShouldHandleEventsAfterCommit` на наблюдателе здесь и ломался:
     * он откладывает весь вызов вместе с тем же объектом модели, а
     * `performUpdate` на каждом сохранении перезаписывает набор изменений.
     * Оба отложенных вызова видели изменения последнего сохранения — и при
     * порядке «без статуса, потом со статусом» владелец получал два
     * одинаковых события, а при обратном порядке не получал ни одного.
     */
    public function test_two_saves_in_one_transaction_say_it_once(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        DB::transaction(function () use ($listing): void {
            $listing->forceFill(['title' => 'Новое название'])->save();
            $listing->forceFill(['status' => ListingStatus::PendingModeration])->save();
        });

        $this->assertSame(
            [['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'pending_moderation']],
            $this->updatesFor($seller),
        );
    }

    /** Обратный порядок — событие всё равно ровно одно. */
    public function test_a_later_save_without_status_does_not_swallow_the_event(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        DB::transaction(function () use ($listing): void {
            $listing->forceFill(['status' => ListingStatus::Sold, 'sold_at' => now()])->save();
            $listing->forceFill(['title' => 'Новое название'])->save();
        });

        $this->assertSame(
            [['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'sold']],
            $this->updatesFor($seller),
        );
    }

    /**
     * Постороннему не приходит ничего.
     *
     * Проверка «автору пришло» держала бы и рассылку всем подряд: канал
     * личный, но адресата выбирает этот код, и ошибка в нём выглядела бы на
     * экране автора совершенно нормально.
     */
    public function test_a_stranger_hears_nothing(): void
    {
        $seller = $this->seedUser();
        $посторонний = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        $listing->forceFill(['status' => ListingStatus::Sold])->save();

        $this->assertNotSame([], $this->updatesFor($seller));
        $this->assertSame([], $this->updatesFor($посторонний));
    }

    /**
     * Восстановление отменяет «удалено».
     *
     * Само по себе меняет только `deleted_at`, то есть смены статуса нет —
     * без отдельного обработчика экран остался бы на «не найдено».
     */
    public function test_restoring_takes_back_the_removal(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        $listing->delete();
        $listing->restore();

        $this->assertSame(
            [
                ['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'deleted'],
                ['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'published'],
            ],
            $this->updatesFor($seller),
        );
    }

    public function test_removal_reaches_the_author(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        $listing->delete();

        $this->assertSame(
            [['kind' => 'listing', 'uuid' => $listing->uuid, 'status' => 'deleted']],
            $this->updatesFor($seller),
        );
    }

    /**
     * Откат транзакции не должен оставлять человека с «перечитай».
     *
     * Вещание немедленное (`ShouldBroadcastNow`), и без
     * `ShouldHandleEventsAfterCommit` клиент получил бы событие о состоянии,
     * которого в базе не будет.
     */
    public function test_rolled_back_change_says_nothing(): void
    {
        $seller = $this->seedUser();
        $listing = $this->listingFor($seller, ListingStatus::Published);

        try {
            DB::transaction(function () use ($listing): void {
                $listing->forceFill(['status' => ListingStatus::Unpublished])->save();
                throw new \RuntimeException('откат');
            });
        } catch (\RuntimeException) {
            // Ровно то, ради чего транзакция здесь и заведена.
        }

        $this->assertSame([], $this->updatesFor($seller));
    }
}
