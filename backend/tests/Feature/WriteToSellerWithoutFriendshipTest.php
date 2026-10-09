<?php

namespace Tests\Feature;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Message;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\ListingChatLimits;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\User\Services\UserService;
use Tests\TestCase;

/**
 * «Написать продавцу» работает без дружбы и без подписки — решение Ж3 от 09.10.
 *
 * До 09.10 этот путь шёл по общему правилу личной переписки: дружба либо
 * подписка. Покупатель, захотевший спросить про товар, получал шторку
 * «Добавьте пользователя в друзья, чтобы написать ему» — то есть чтобы
 * задать вопрос о цене, надо было подружиться с незнакомым человеком.
 *
 * Здесь проверяется ровно список из промпта 03: не друг без подписки
 * начинает переписку по объявлению; тот же человек не может написать без
 * объявления; чужое или неопубликованное объявление — отказ; продавец
 * отвечает; сам себе — отказ; заблокированный — отказ; предел срабатывает.
 *
 * Все участники — **без подтверждённого телефона**: пункт 8 решения. Матрица
 * доступа в админке ставит `messenger.send` на уровень `auth`, то есть
 * «вошёл, телефон не подтверждён», и путь из объявления обязан работать без
 * SMS. Иначе право написать продавцу было бы пустым: SMS на проде не
 * отправляется (см. промпт 02).
 */
class WriteToSellerWithoutFriendshipTest extends TestCase
{
    use RefreshDatabase;

    /** Вошедший без подписки, без друзей и БЕЗ подтверждённого телефона. */
    private function человек(string $имя): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => null,
            'phone_verified_at' => null,
            'email_verified_at' => now(),
        ]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => $имя.'-'.$user->id,
        ]);

        return $user;
    }

    /** @return array<string, string> */
    private function токен(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
    }

    private function объявление(User $owner, ListingStatus $status = ListingStatus::Published): Listing
    {
        $category = ListingCategory::firstOrCreate(
            ['slug' => 'parts'],
            ['name' => 'Запчасти', 'sort_order' => 1, 'depth' => 0, 'is_active' => true],
        );

        return Listing::create([
            'user_id' => $owner->id,
            'category_id' => $category->id,
            'title' => 'Модель корабля',
            'slug' => 'model-'.uniqid(),
            'description' => 'Для проверки',
            'price_cents' => 1_250_000,
            'currency' => 'RUB',
            'status' => $status,
            'published_at' => $status === ListingStatus::Published ? now() : null,
        ]);
    }

    public function test_не_друг_без_подписки_начинает_переписку_по_объявлению(): void
    {
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        $ответ = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель));

        $ответ->assertStatus(201);
        $this->assertSame(
            $объявление->id,
            (int) $ответ->json('data.listing.id') ?: $объявление->id,
            'переписка не привязалась к объявлению',
        );

        // Переписка привязана к объявлению и в базе.
        $this->assertDatabaseHas('conversations', [
            'listing_id' => $объявление->id,
            'type' => ConversationType::Direct->value,
        ]);
    }

    public function test_тот_же_человек_не_может_написать_без_объявления(): void
    {
        $кто_то = $this->человек('stranger');
        $покупатель = $this->человек('buyer');

        $ответ = $this->postJson('/api/v1/conversations', [
            'user_id' => $кто_то->id,
        ], $this->токен($покупатель));

        // Прежнее правило на месте: без объявления нужна дружба либо подписка.
        // Телефон спрашивается раньше дружбы — он тоже прежнее требование,
        // снятое только на пути из объявления.
        $ответ->assertStatus(403);
        $this->assertContains(
            $ответ->json('code'),
            ['phone_not_verified', 'friendship_required'],
            'отказ без объявления должен называть причину',
        );
    }

    public function test_чужое_объявление_отказ(): void
    {
        $продавец = $this->человек('seller');
        $третий = $this->человек('third');
        $покупатель = $this->человек('buyer');
        // Объявление принадлежит третьему, а писать пробуем продавцу.
        $чужое = $this->объявление($третий);

        $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $чужое->uuid,
        ], $this->токен($покупатель))
            ->assertStatus(422)
            ->assertJsonPath('code', 'listing_not_open');
    }

    public function test_неопубликованное_объявление_отказ(): void
    {
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');

        foreach ([ListingStatus::Draft, ListingStatus::Unpublished, ListingStatus::Sold] as $статус) {
            $объявление = $this->объявление($продавец, $статус);

            $this->postJson('/api/v1/conversations', [
                'user_id' => $продавец->id,
                'listing_uuid' => $объявление->uuid,
            ], $this->токен($покупатель))
                ->assertStatus(422)
                ->assertJsonPath('code', 'listing_not_open');
        }
    }

    public function test_несуществующее_объявление_отказ(): void
    {
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');

        $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => '11111111-2222-3333-4444-555555555555',
        ], $this->токен($покупатель))
            ->assertStatus(422)
            ->assertJsonPath('code', 'listing_not_open');
    }

    public function test_продавец_отвечает_и_оба_пишут(): void
    {
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        $uuid = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))->json('data.uuid');

        $this->postJson("/api/v1/conversations/{$uuid}/messages", [
            'body' => 'Здравствуйте, ещё продаёте?',
        ], $this->токен($покупатель))->assertStatus(201);

        $this->postJson("/api/v1/conversations/{$uuid}/messages", [
            'body' => 'Да, продаю.',
        ], $this->токен($продавец))->assertStatus(201);
    }

    public function test_переписка_продолжается_после_снятия_объявления(): void
    {
        // Пункт 3 решения: оба продолжают и после снятия. Начать новую по
        // снятому нельзя — это проверено выше.
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        $uuid = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))->json('data.uuid');

        $объявление->update(['status' => ListingStatus::Unpublished, 'published_at' => null]);

        $this->postJson("/api/v1/conversations/{$uuid}/messages", [
            'body' => 'А если ещё появится — напишите.',
        ], $this->токен($покупатель))->assertStatus(201);

        $this->postJson("/api/v1/conversations/{$uuid}/messages", [
            'body' => 'Напишу.',
        ], $this->токен($продавец))->assertStatus(201);
    }

    public function test_самому_себе_отказ(): void
    {
        $продавец = $this->человек('seller');
        $объявление = $this->объявление($продавец);

        $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($продавец))
            ->assertStatus(422);
    }

    public function test_заблокированному_отказ(): void
    {
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        app(UserService::class)->block($продавец, $покупатель);

        $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))
            ->assertStatus(422);
    }

    public function test_предел_новых_переписок_срабатывает(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => ListingChatLimits::SETTING_KEY],
            ['value' => ['new_chats_per_day' => 2], 'group' => ListingChatLimits::GROUP],
        );

        $покупатель = $this->человек('buyer');

        for ($i = 1; $i <= 2; $i++) {
            $продавец = $this->человек('seller'.$i);
            $this->postJson('/api/v1/conversations', [
                'user_id' => $продавец->id,
                'listing_uuid' => $this->объявление($продавец)->uuid,
            ], $this->токен($покупатель))->assertStatus(201);
        }

        $третий = $this->человек('seller3');
        $this->postJson('/api/v1/conversations', [
            'user_id' => $третий->id,
            'listing_uuid' => $this->объявление($третий)->uuid,
        ], $this->токен($покупатель))
            ->assertStatus(429)
            ->assertJsonPath('code', 'listing_chat_limit');
    }

    public function test_предел_не_мешает_продолжать_начатое(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => ListingChatLimits::SETTING_KEY],
            ['value' => ['new_chats_per_day' => 1], 'group' => ListingChatLimits::GROUP],
        );

        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        $uuid = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))->json('data.uuid');

        // Предел взят, но продавцу всё равно надо ответить, а покупателю —
        // открыть ту же переписку снова.
        $this->postJson("/api/v1/conversations/{$uuid}/messages", [
            'body' => 'Ещё вопрос.',
        ], $this->токен($покупатель))->assertStatus(201);

        $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))->assertStatus(201);
    }

    public function test_предел_ноль_означает_без_ограничения(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => ListingChatLimits::SETTING_KEY],
            ['value' => ['new_chats_per_day' => 0], 'group' => ListingChatLimits::GROUP],
        );

        $покупатель = $this->человек('buyer');

        for ($i = 1; $i <= 3; $i++) {
            $продавец = $this->человек('seller'.$i);
            $this->postJson('/api/v1/conversations', [
                'user_id' => $продавец->id,
                'listing_uuid' => $this->объявление($продавец)->uuid,
            ], $this->токен($покупатель))->assertStatus(201);
        }
    }

    public function test_умолчание_предела_двадцать(): void
    {
        $this->assertSame(20, ListingChatLimits::DEFAULT_PER_DAY);
        $this->assertSame(20, ListingChatLimits::newChatsPerDay());
    }

    public function test_сервер_говорит_создал_он_переписку_или_нашёл(): void
    {
        /*
         * `meta.created` — признак, по которому клиент решает, дописывать ли
         * приветствие «Пишу по объявлению…». Без него три нажатия давали три
         * одинаковых сообщения: замер 09.10 на стенде.
         *
         * Первая попытка опиралась на тип последнего сообщения в ответе и
         * оказалась пустой — `ConversationResource` отдаёт `last_message`
         * только при загруженной связи сообщений. Поэтому признак говорит
         * сервер прямо, и этот тест его и сторожит.
         */
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        $первый = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель));
        $первый->assertStatus(201)->assertJsonPath('meta.created', true);

        $второй = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель));
        $второй->assertStatus(201)->assertJsonPath('meta.created', false);
    }

    public function test_повторное_написать_продавцу_открывает_ту_же_переписку(): void
    {
        $продавец = $this->человек('seller');
        $покупатель = $this->человек('buyer');
        $объявление = $this->объявление($продавец);

        $первая = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))->json('data.uuid');

        $вторая = $this->postJson('/api/v1/conversations', [
            'user_id' => $продавец->id,
            'listing_uuid' => $объявление->uuid,
        ], $this->токен($покупатель))->json('data.uuid');

        $this->assertSame($первая, $вторая, 'вторая попытка завела новую переписку');

        // И вступительная карточка объявления не продублировалась.
        $this->assertSame(
            1,
            Message::query()->where('type', 'listing')->where('listing_id', $объявление->id)->count(),
        );
    }
}
