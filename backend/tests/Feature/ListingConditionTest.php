<?php

namespace Tests\Feature;

use App\Enums\ListingCondition;
use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Состояние товара: «новое» или «б/у».
 *
 * Форма подачи спрашивала его с самого начала, а сохранять было некуда:
 * `createListing` значение не отправлял, колонки не существовало, и каталог
 * рисовал состояние только на демо-данных. Проверяем весь путь — от подачи
 * до карточки каталога, — потому что рвался он посередине и с обоих концов
 * выглядел исправным.
 */
class ListingConditionTest extends TestCase
{
    use RefreshDatabase;

    private function seller(): User
    {
        return User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function category(): ListingCategory
    {
        return ListingCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviaciya-'.uniqid(),
            'is_active' => true,
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        // Платное размещение и премодерация к состоянию товара отношения не
        // имеют, а без этих двух настроек подача упирается в оплату раньше,
        // чем доходит до проверяемого поля.
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => false], 'group' => 'feature'],
        );
        SystemSetting::query()->updateOrCreate(
            ['key' => 'moderation_auto_publish'],
            ['value' => ['enabled' => true], 'group' => 'moderation'],
        );
    }

    /** @param array<string, mixed> $extra */
    private function makeListing(User $seller, array $extra = []): Listing
    {
        return Listing::query()->create(array_merge([
            'user_id' => $seller->id,
            'category_id' => $this->category()->id,
            'title' => 'Модель',
            'slug' => 'model-'.uniqid(),
            'description' => 'Описание достаточной длины.',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ], $extra));
    }

    public function test_состояние_сохраняется_при_подаче_объявления(): void
    {
        $seller = $this->seller();
        $category = $this->category();

        $uuid = $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Модель Ил-76',
                'description' => 'Собранная модель в коробке.',
                'category_id' => $category->id,
                'price_cents' => 500000,
                'condition' => 'used',
                'publish' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.condition', 'used')
            ->json('data.uuid');

        $this->assertSame(
            ListingCondition::Used,
            Listing::query()->where('uuid', $uuid)->firstOrFail()->condition,
        );
    }

    public function test_состояние_видно_в_каталоге(): void
    {
        $seller = $this->seller();
        $listing = $this->makeListing($seller, ['condition' => ListingCondition::New]);

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $listing->uuid)
            ->assertJsonPath('data.0.condition', 'new');
    }

    public function test_состояние_меняется_при_правке(): void
    {
        $seller = $this->seller();
        $listing = $this->makeListing($seller, ['condition' => ListingCondition::Used]);

        $this->actingAs($seller, 'sanctum')
            ->patchJson('/api/v1/listings/'.$listing->uuid, ['condition' => 'new'])
            ->assertOk()
            ->assertJsonPath('data.condition', 'new');

        $this->assertSame(ListingCondition::New, $listing->fresh()->condition);
    }

    public function test_чужое_значение_состояния_отклоняется(): void
    {
        $seller = $this->seller();

        $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Модель',
                'description' => 'Описание достаточной длины.',
                'category_id' => $this->category()->id,
                'price_cents' => 1000,
                'condition' => 'подержанное',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('condition');
    }

    /**
     * Контроль: без правки поле не доезжает.
     *
     * Проверка того, что значение сохранилось, сама по себе не доказывает,
     * что до правки оно терялось, — а именно это и было дефектом. Здесь
     * подаём объявление вообще без `condition` и убеждаемся, что колонка
     * остаётся пустой, а карточка состояния не показывает: «не указано»
     * должно отличаться от «б/у», иначе старые объявления получили бы
     * состояние, которого продавец не выбирал.
     */
    public function test_без_состояния_поле_остаётся_пустым(): void
    {
        $seller = $this->seller();

        $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Модель без состояния',
                'description' => 'Описание достаточной длины.',
                'category_id' => $this->category()->id,
                'price_cents' => 1000,
            ])
            ->assertCreated()
            ->assertJsonPath('data.condition', null);
    }
}
