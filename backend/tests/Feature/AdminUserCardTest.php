<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Карточка пользователя в админке — одно окно вместо иконки-заглушки.
 *
 * До 27.09 глаз в списке пользователей вызывал `toast.info` с именем и
 * больше ничего: действие выглядело как «посмотреть», а смотреть было
 * нечего. Чтобы ответить на вопрос «что за человек и что мы потеряем,
 * если удалим учётку», приходилось идти в базу.
 *
 * Деньги в карточке — только Владельцу. Раздел `users` открыт модератору,
 * но в этом коде деньги везде закрыты уровнем `users.manage`, и карточка
 * это правило не ослабляет: модератору поля не приходят вовсе, а не
 * приходят нулями.
 */
class AdminUserCardTest extends TestCase
{
    use RefreshDatabase;

    private function человек(UserRole $role = UserRole::User, string $имя = 'Человек'): User
    {
        $user = User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'name' => $имя,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function карточка(User $кто, User $очём): array
    {
        return $this->actingAs($кто, 'sanctum')
            ->getJson("/api/v1/admin/users/{$очём->uuid}/card")
            ->assertOk()
            ->json('data');
    }

    public function test_карточка_собирает_профиль_счётчики_и_пространства(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $герой = $this->человек(UserRole::User, 'Герой');
        $герой->forceFill([
            'phone' => '+79990001122',
            'phone_verified_at' => now(),
            'listing_placement_credits' => 3,
        ])->save();

        $категорияОбъявлений = ListingCategory::query()->create([
            'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
        ]);
        foreach (range(1, 2) as $i) {
            Listing::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $герой->id,
                'category_id' => $категорияОбъявлений->id,
                'title' => "Лот {$i}",
                'slug' => 'lot-'.uniqid(),
                'description' => 'Описание',
                'price_cents' => 100000,
                'currency' => 'RUB',
                'status' => ListingStatus::Published,
                'published_at' => now(),
            ]);
        }

        $категорияЗаписей = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'av-'.uniqid(), 'sort_order' => 1, 'depth' => 0, 'is_active' => true,
        ]);
        Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $герой->id,
            'category_id' => $категорияЗаписей->id,
            'title' => 'Запись',
            'body' => 'Текст',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        $категорияСообществ = CommunityCategory::query()->create([
            'name' => 'По масштабу', 'slug' => 'pm-'.uniqid(), 'sort_order' => 1, 'depth' => 0, 'is_active' => true,
        ]);
        Community::query()->create([
            'name' => 'Клуб масштабников',
            'slug' => 'klub-'.uniqid(),
            'description' => 'Описание',
            'category_id' => $категорияСообществ->id,
            'created_by' => $герой->id,
            'status' => 'active',
        ]);

        Channel::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Канал героя',
            'slug' => 'kanal-'.uniqid(),
            'owner_id' => $герой->id,
        ]);

        $card = $this->карточка($owner, $герой);

        $this->assertSame('Герой', $card['display_name']);
        $this->assertSame($герой->email, $card['email']);
        $this->assertSame('+79990001122', $card['phone']);
        $this->assertTrue($card['phone_verified']);
        $this->assertSame('user', $card['role']);
        $this->assertSame('active', $card['status']);
        $this->assertNotNull($card['registered_at']);

        $this->assertSame(2, $card['counts']['listings'], 'объявления');
        $this->assertSame(1, $card['counts']['posts'], 'записи');

        $this->assertSame(['Клуб масштабников'], $card['spaces']['communities_created']);
        $this->assertSame(['Канал героя'], $card['spaces']['channels_owned']);

        $this->assertSame(3, $card['placements']['stock'], 'запас размещений');
    }

    /**
     * Удалённое объявление в счётчик не идёт.
     *
     * Иначе карточка отвечала бы на вопрос «сколько у человека объявлений»
     * числом, которого он у себя не видит.
     */
    public function test_удалённое_объявление_не_считается(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $герой = $this->человек(UserRole::User, 'Герой');

        $категория = ListingCategory::query()->create([
            'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
        ]);
        $лот = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $герой->id,
            'category_id' => $категория->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        $this->assertSame(1, $this->карточка($owner, $герой)['counts']['listings']);

        $лот->delete();

        $this->assertSame(0, $this->карточка($owner, $герой)['counts']['listings']);
    }

    /** Кошелёк и журнал начислений — только Владельцу. */
    public function test_деньги_модератору_не_приходят(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');
        $герой = $this->человек(UserRole::User, 'Герой');

        DB::table('wallets')->insert([
            'user_id' => $герой->id,
            'balance_kopecks' => 250000,
            'held_kopecks' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $увладельца = $this->карточка($owner, $герой);
        $this->assertSame(250000, $увладельца['wallet']['balance_kopecks']);
        $this->assertArrayHasKey('placement_grants', $увладельца);

        $умодератора = $this->карточка($moderator, $герой);
        $this->assertArrayNotHasKey('wallet', $умодератора, 'кошелёк модератору не показываем');
        $this->assertArrayNotHasKey('placement_grants', $умодератора);
        // Но сама карточка ему открыта — раздел `users` его.
        $this->assertSame('Герой', $умодератора['display_name']);
    }

    /** Посторонний карточку не открывает. */
    public function test_обычный_пользователь_получает_отказ(): void
    {
        $чужой = $this->человек(UserRole::User, 'Чужой');
        $герой = $this->человек(UserRole::User, 'Герой');

        $this->actingAs($чужой, 'sanctum')
            ->getJson("/api/v1/admin/users/{$герой->uuid}/card")
            ->assertForbidden();

        // Гостю админка отвечает 403, а не 401 — так во всём разделе, не
        // только здесь. Закрепляю то, что есть, а не то, как было бы стройнее.
        $this->getJson("/api/v1/admin/users/{$герой->uuid}/card")->assertForbidden();
    }

    /**
     * В карточке видно, что с учёткой делали.
     *
     * Журнал отбирается по предмету действия, а не по тому, кто действовал:
     * карточку открывают, чтобы понять, что происходило с этим человеком.
     */
    public function test_журнал_показывает_действия_над_учёткой(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $герой = $this->человек(UserRole::User, 'Герой');

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/v1/admin/users/{$герой->uuid}", ['status' => 'blocked'])
            ->assertOk();

        $card = $this->карточка($owner, $герой);

        $this->assertNotEmpty($card['audit'], 'блокировка обязана оставить след');
        $this->assertSame('admin.users.update', $card['audit'][0]['action']);
        $this->assertSame('Владелец', $card['audit'][0]['by'], 'видно, кто это сделал');
        $this->assertSame('blocked', $card['audit'][0]['new_values']['status']);
    }

    /**
     * Запас размещений и квоты показаны раздельно.
     *
     * Это три разные вещи с похожими числами: льгота на человека, квота
     * подписки и запас штук. Старое название «кредиты размещения» их
     * смешивало, и карточка обязана их развести.
     */
    public function test_запас_и_квоты_разведены(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $герой = $this->человек(UserRole::User, 'Герой');
        $герой->forceFill([
            'listing_placement_credits' => 2,
            'free_listings_quota' => 5,
            'free_listings_used' => 1,
        ])->save();

        $card = $this->карточка($owner, $герой)['placements'];

        $this->assertSame(2, $card['stock'], 'штуки в запасе');
        $this->assertSame(4, $card['personal_quota_remaining'], 'личная квота: 5 минус 1 использованная');
        $this->assertFalse($card['personal_quota_unlimited']);

        $герой->forceFill(['free_listings_unlimited' => true])->save();
        $безПредела = $this->карточка($owner, $герой)['placements'];

        $this->assertTrue($безПредела['personal_quota_unlimited']);
        $this->assertNull($безПредела['personal_quota_remaining']);
        $this->assertSame(2, $безПредела['stock'], 'запас от безлимита не зависит');
    }

    public function test_несуществующий_пользователь_даёт_404(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/users/'.Str::uuid().'/card')
            ->assertNotFound();
    }
}
