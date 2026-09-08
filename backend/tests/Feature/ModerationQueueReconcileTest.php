<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ModerationQueue;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Сверка очереди модерации с фактом.
 *
 * Разбирается след аварии, а не сама авария: путь, который её создавал,
 * закрыт 08.09, но пять строк на проде остались висеть в `pending` при
 * опубликованных объявлениях.
 *
 * Главное, что здесь закреплено, — команда не угадывает. Она чинит только
 * однозначные развязки (опубликован, отклонён) и не трогает те, где по
 * статусу объекта нельзя сказать, была ли модерация.
 */
class ModerationQueueReconcileTest extends TestCase
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

    private function listingWithOpenTask(ListingStatus $status): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->seedUser()->id,
            'category_id' => $category->id,
            'title' => 'Лот '.$status->value,
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => $status,
            'published_at' => $status === ListingStatus::Published ? now() : null,
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

    public function test_dry_run_changes_nothing(): void
    {
        $listing = $this->listingWithOpenTask(ListingStatus::Published);

        $this->artisan('moderation:reconcile-queue')->assertSuccessful();

        $this->assertSame('pending', $this->queueStatus($listing));
    }

    public function test_published_listing_closes_its_task_as_approved(): void
    {
        $listing = $this->listingWithOpenTask(ListingStatus::Published);

        $this->artisan('moderation:reconcile-queue', ['--apply' => true])->assertSuccessful();

        $this->assertSame('approved', $this->queueStatus($listing));
    }

    public function test_rejected_listing_closes_its_task_as_rejected(): void
    {
        $listing = $this->listingWithOpenTask(ListingStatus::Rejected);

        $this->artisan('moderation:reconcile-queue', ['--apply' => true])->assertSuccessful();

        $this->assertSame('rejected', $this->queueStatus($listing));
    }

    public function test_unclear_outcomes_are_left_alone(): void
    {
        // Снят с публикации и продан — по ним нельзя сказать, была модерация
        // или нет. Угадывать нельзя: очередь должна остаться честной.
        $unpublished = $this->listingWithOpenTask(ListingStatus::Unpublished);
        $sold = $this->listingWithOpenTask(ListingStatus::Sold);
        $waiting = $this->listingWithOpenTask(ListingStatus::PendingModeration);

        $this->artisan('moderation:reconcile-queue', ['--apply' => true])->assertSuccessful();

        $this->assertSame('pending', $this->queueStatus($unpublished));
        $this->assertSame('pending', $this->queueStatus($sold));
        $this->assertSame('pending', $this->queueStatus($waiting));
    }

    public function test_author_of_the_decision_is_restored_from_the_audit_log(): void
    {
        $admin = $this->seedUser(UserRole::Admin);
        $listing = $this->listingWithOpenTask(ListingStatus::Published);

        DB::table('audit_logs')->insert([
            'user_id' => $admin->id,
            'action' => 'admin.listings.update',
            'auditable_type' => Listing::class,
            'auditable_id' => $listing->id,
            'old_values' => json_encode(['status' => 'pending_moderation']),
            'new_values' => json_encode(['status' => 'published']),
            'created_at' => now()->subDays(7),
        ]);

        $this->artisan('moderation:reconcile-queue', ['--apply' => true])->assertSuccessful();

        $this->assertDatabaseHas('moderation_actions', [
            'moderatable_type' => Listing::class,
            'moderatable_id' => $listing->id,
            'actor_id' => $admin->id,
            'action' => 'approve',
        ]);
    }

    public function test_decision_is_not_invented_when_the_audit_log_is_silent(): void
    {
        $listing = $this->listingWithOpenTask(ListingStatus::Published);

        $this->artisan('moderation:reconcile-queue', ['--apply' => true])->assertSuccessful();

        // Очередь починена, но автор не выдуман.
        $this->assertSame('approved', $this->queueStatus($listing));
        $this->assertDatabaseMissing('moderation_actions', [
            'moderatable_type' => Listing::class,
            'moderatable_id' => $listing->id,
        ]);
    }
}
