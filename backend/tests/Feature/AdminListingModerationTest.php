<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ModerationAction;
use App\Models\ModerationQueue;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Редактор объявлений в админке — тоже модерация.
 *
 * До 08.09 он присваивал `status` напрямую, и очередь об этом не узнавала.
 * На проде так и вышло: пять объявлений опубликованы из редактора 01.09
 * (журнал аудита, переход `pending_moderation -> published`), а их записи в
 * очереди с тех пор лежат в `pending`. Модератор видел пять решённых задач,
 * авторы не получили уведомления, а в `moderation_actions` не осталось следа.
 *
 * Проверяется не «статус поменялся» — это работало и раньше, — а что решение
 * дошло до всех трёх мест: объявления, очереди и журнала действий.
 */
class AdminListingModerationTest extends TestCase
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

    private function pendingListing(User $seller): Listing
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
            'title' => 'Лот на проверке',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::PendingModeration,
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

    private function queueStatus(Listing $listing): ?string
    {
        return ModerationQueue::query()
            ->where('moderatable_type', Listing::class)
            ->where('moderatable_id', $listing->id)
            ->value('status');
    }

    public function test_publishing_from_the_admin_editor_closes_the_queue_task(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $listing = $this->pendingListing($this->seedUser());

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'published'])
            ->assertOk()
            ->assertJsonPath('data.status', 'published');

        $listing->refresh();

        $this->assertSame(ListingStatus::Published, $listing->status);
        $this->assertNotNull($listing->published_at, 'дата публикации должна проставиться');

        // Ровно то, чего не делал прежний код.
        $this->assertSame('approved', $this->queueStatus($listing), 'задача в очереди осталась висеть');
        $this->assertDatabaseHas('moderation_actions', [
            'moderatable_type' => Listing::class,
            'moderatable_id' => $listing->id,
            'actor_id' => $admin->id,
            'action' => 'approve',
        ]);
    }

    public function test_rejecting_from_the_admin_editor_records_the_decision(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $listing = $this->pendingListing($this->seedUser());

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", [
                'status' => 'rejected',
                'rejection_reason' => 'Фотографии чужие.',
            ])
            ->assertOk();

        $listing->refresh();

        $this->assertSame(ListingStatus::Rejected, $listing->status);
        $this->assertSame('Фотографии чужие.', $listing->rejection_reason);
        $this->assertSame('rejected', $this->queueStatus($listing));
        $this->assertDatabaseHas('moderation_actions', [
            'moderatable_id' => $listing->id,
            'action' => 'reject',
            'reason' => 'Фотографии чужие.',
        ]);
    }

    public function test_sending_back_to_moderation_creates_a_task(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $seller = $this->seedUser();
        $listing = $this->pendingListing($seller);

        // Сперва опубликуем, чтобы очередь закрылась.
        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'published'])
            ->assertOk();
        $this->assertSame('approved', $this->queueStatus($listing->refresh()));

        // Возврат на проверку обязан снова завести задачу — иначе получится та
        // же беда зеркально: статус есть, задачи у модератора нет.
        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'pending_moderation'])
            ->assertOk();

        $listing->refresh();
        $this->assertSame(ListingStatus::PendingModeration, $listing->status);
        $this->assertNull($listing->published_at, 'снятая с публикации дата не должна оставаться');
        $this->assertSame('pending', $this->queueStatus($listing));
    }

    public function test_non_moderation_statuses_do_not_touch_the_queue(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $listing = $this->pendingListing($this->seedUser());

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'unpublished'])
            ->assertOk();

        // Снятие с публикации решением модератора не является: задача остаётся
        // на месте, а не помечается разобранной.
        $this->assertSame(ListingStatus::Unpublished, $listing->refresh()->status);
        $this->assertSame('pending', $this->queueStatus($listing));
    }

    /**
     * Номер задачи из очереди вместо uuid — «не найдено», а не пятисотка.
     *
     * В очереди у задачи свой числовой id, и подставить его в адрес — первое,
     * что делает человек, читающий её вывод. До 08.09 PostgreSQL получал
     * `where uuid = 97`, отвечал «invalid input syntax for type uuid», и
     * админка показывала «Server Error».
     */
    public function test_queue_id_instead_of_uuid_is_not_a_server_error(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $this->pendingListing($this->seedUser());

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/moderation/listings/97/approve')
            ->assertNotFound();
    }

    public function test_editing_text_without_a_status_leaves_moderation_alone(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $listing = $this->pendingListing($this->seedUser());

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['title' => 'Другое имя'])
            ->assertOk();

        $listing->refresh();
        $this->assertSame('Другое имя', $listing->title);
        $this->assertSame(ListingStatus::PendingModeration, $listing->status);
        $this->assertSame('pending', $this->queueStatus($listing));
        $this->assertDatabaseMissing('moderation_actions', ['moderatable_id' => $listing->id]);
    }
}
