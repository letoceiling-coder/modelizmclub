<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\ClubEvent;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Modules\Community\Jobs\SendClubEventNotificationsJob;
use Modules\Community\Services\ClubEventService;
use Tests\TestCase;

/**
 * Модуль мероприятий: событие сообщества и событие площадки — одна модель.
 * Проверки — те, что заказчик назвал в приёмке 14.09.
 */
class ClubEventsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_owner_creates_event_and_it_appears_in_list_and_page(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        Sanctum::actingAs($owner);

        $uuid = $this->postJson("/api/v1/communities/{$community->slug}/events", [
            'title' => 'Встреча клуба',
            'description' => 'Показываем работы',
            'starts_at' => now()->addDays(3)->toIso8601String(),
            'location_name' => 'Клуб, зал 1',
            'latitude' => 55.75,
            'longitude' => 37.61,
        ])->assertCreated()
            ->assertJsonPath('data.scope', 'community')
            ->assertJsonPath('data.display_status', 'published')
            ->assertJsonPath('data.can.update', true)
            ->json('data.uuid');

        $this->getJson("/api/v1/communities/{$community->slug}/events")
            ->assertOk()->assertJsonPath('data.0.uuid', $uuid);
        $this->getJson("/api/v1/events/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.community.slug', $community->slug)
            ->assertJsonPath('data.map_url', fn ($v) => is_string($v) && str_contains($v, 'openstreetmap'));

        Queue::assertPushed(SendClubEventNotificationsJob::class, fn ($job) => $job->kind === 'published');
        $this->assertTrue(AuditLog::query()->where('action', 'event.create')->exists());
    }

    public function test_starts_at_in_utc_keeps_the_instant_under_moscow_app_timezone(): void
    {
        // Прод живёт по Москве, колонки — timestamp без пояса. 14.09 форма
        // отправила «…T00:16:00Z» (03:16 МСК), в базу легло «00:16», и
        // карточка показала время на три часа раньше.
        $this->inAppTimezone('Europe/Moscow', function (): void {
            $owner = $this->user();
            $community = $this->community($owner);
            Sanctum::actingAs($owner);

            $utc = now('UTC')->addDays(2)->setTime(0, 16)->toIso8601ZuluString();
            $uuid = $this->postJson("/api/v1/communities/{$community->slug}/events", [
                'title' => 'Сверка пояса',
                'starts_at' => $utc,
            ])->assertCreated()->json('data.uuid');

            $returned = $this->getJson("/api/v1/events/{$uuid}")->assertOk()->json('data.starts_at');
            $this->assertTrue(
                Carbon::parse($returned)->equalTo(Carbon::parse($utc)),
                "ожидали {$utc}, сервер вернул {$returned}",
            );
            $this->assertSame('03:16', ClubEvent::query()->where('uuid', $uuid)->firstOrFail()->starts_at->setTimezone('Europe/Moscow')->format('H:i'));

            // Правка — тот же путь.
            $moved = now('UTC')->addDays(3)->setTime(9, 0)->toIso8601ZuluString();
            $this->patchJson("/api/v1/events/{$uuid}", ['starts_at' => $moved])->assertOk();
            $this->assertTrue(Carbon::parse(
                $this->getJson("/api/v1/events/{$uuid}")->json('data.starts_at')
            )->equalTo(Carbon::parse($moved)));
        });
    }

    public function test_member_cannot_create_event(): void
    {
        $community = $this->community($this->user());
        Sanctum::actingAs($this->joinedUser($community));

        $this->postJson("/api/v1/communities/{$community->slug}/events", [
            'title' => 'Самовольная встреча',
            'starts_at' => now()->addDay()->toIso8601String(),
        ])->assertForbidden();
    }

    public function test_attendance_is_idempotent_and_counter_grows(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $event = $this->event($community, $owner);
        $member = $this->joinedUser($community);
        Sanctum::actingAs($member);

        $this->postJson("/api/v1/events/{$event->uuid}/attendance")->assertOk()
            ->assertJsonPath('data.attendees_count', 1)->assertJsonPath('data.going', true);
        // Повтор — не снимает отметку.
        $this->postJson("/api/v1/events/{$event->uuid}/attendance")->assertOk()
            ->assertJsonPath('data.attendees_count', 1)->assertJsonPath('data.going', true);

        $this->getJson("/api/v1/events/{$event->uuid}/attendees")->assertOk()->assertJsonPath('meta.total', 1);

        $this->deleteJson("/api/v1/events/{$event->uuid}/attendance")->assertOk()
            ->assertJsonPath('data.attendees_count', 0)->assertJsonPath('data.going', false);
    }

    public function test_attending_open_community_event_joins_the_community(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $event = $this->event($community, $owner);
        $stranger = $this->user();
        Sanctum::actingAs($stranger);

        $this->postJson("/api/v1/events/{$event->uuid}/attendance")->assertOk()->assertJsonPath('joined', true);
        $this->assertTrue($community->members()->where('users.id', $stranger->id)->exists());
    }

    public function test_closed_community_event_is_hidden_from_non_members(): void
    {
        $owner = $this->user();
        $community = $this->community($owner, 'request');
        $event = $this->event($community, $owner);
        Sanctum::actingAs($this->user());

        $this->getJson("/api/v1/events/{$event->uuid}")->assertNotFound();
        $this->postJson("/api/v1/events/{$event->uuid}/attendance")->assertNotFound();
    }

    public function test_community_is_limited_to_ten_upcoming_events(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        for ($i = 0; $i < ClubEvent::COMMUNITY_UPCOMING_LIMIT; $i++) {
            $this->event($community, $owner);
        }
        // Прошедшие и черновики в лимит не входят.
        $this->event($community, $owner, ['starts_at' => now()->subDay()]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/v1/communities/{$community->slug}/events", [
            'title' => 'Одиннадцатая',
            'starts_at' => now()->addDays(40)->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('starts_at');

        $this->postJson("/api/v1/communities/{$community->slug}/events", [
            'title' => 'Черновик сверх лимита',
            'starts_at' => now()->addDays(40)->toIso8601String(),
            'status' => 'draft',
        ])->assertCreated();
    }

    public function test_past_events_go_to_their_own_list(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $upcoming = $this->event($community, $owner);
        $past = $this->event($community, $owner, ['starts_at' => now()->subDays(2)]);

        $this->getJson("/api/v1/communities/{$community->slug}/events?when=upcoming")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.uuid', $upcoming->uuid);
        $this->getJson("/api/v1/communities/{$community->slug}/events?when=past")
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $past->uuid)
            ->assertJsonPath('data.0.display_status', 'past');

        Sanctum::actingAs($this->joinedUser($community));
        $this->postJson("/api/v1/events/{$past->uuid}/attendance")->assertForbidden();
    }

    public function test_only_admin_creates_platform_event_and_banner_registers(): void
    {
        Sanctum::actingAs($this->user());
        $this->postJson('/api/v1/admin/events', [
            'title' => 'Открытие МоДелизМ',
            'starts_at' => now()->addDays(10)->toIso8601String(),
        ])->assertForbidden();

        $admin = $this->user(UserRole::Owner);
        Sanctum::actingAs($admin);
        $uuid = $this->postJson('/api/v1/admin/events', [
            'title' => 'Открытие МоДелизМ',
            'starts_at' => now()->addDays(10)->toIso8601String(),
            'location_name' => 'Краснодар',
        ])->assertCreated()->assertJsonPath('data.scope', 'platform')->json('data.uuid');
        $this->assertTrue(AuditLog::query()->where('action', 'admin.events.create')->exists());

        $this->postJson('/api/v1/admin/banners', [
            'placement' => 'events',
            'title' => 'Скоро открытие',
            'kind' => 'event',
            'is_active' => true,
            'event_uuid' => $uuid,
        ])->assertCreated()->assertJsonPath('data.event_uuid', $uuid);

        $slides = $this->getJson('/api/v1/public/banners?placement=events')->assertOk()->json('data');
        $this->assertSame([$uuid], array_values(array_filter(array_map(fn ($b) => $b['event']['uuid'] ?? null, $slides))));

        $viewer = $this->user();
        Sanctum::actingAs($viewer);
        $this->getJson('/api/v1/events')->assertOk()->assertJsonPath('data.0.uuid', $uuid);
        $this->postJson("/api/v1/events/{$uuid}/attendance")->assertOk()->assertJsonPath('data.attendees_count', 1);
    }

    public function test_banner_rejects_community_event(): void
    {
        $owner = $this->user();
        $event = $this->event($this->community($owner), $owner);
        Sanctum::actingAs($this->user(UserRole::Owner));

        $this->postJson('/api/v1/admin/banners', [
            'placement' => 'events', 'title' => 'x', 'event_uuid' => $event->uuid,
        ])->assertUnprocessable()->assertJsonValidationErrors('event_uuid');
    }

    public function test_cancel_notifies_attendees_and_delete_is_soft_and_audited(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $event = $this->event($community, $owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/v1/events/{$event->uuid}/cancel", ['reason' => 'Зал закрыт'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');
        Queue::assertPushed(SendClubEventNotificationsJob::class, fn ($job) => $job->kind === 'cancelled');
        $this->patchJson("/api/v1/events/{$event->uuid}", ['title' => 'Новое'])->assertForbidden();

        $second = $this->event($community, $owner);
        $this->deleteJson("/api/v1/events/{$second->uuid}")->assertOk();
        $this->assertSoftDeleted('club_events', ['id' => $second->id]);
        $this->assertSame('cancelled', ClubEvent::withTrashed()->find($second->id)->status);
        $this->assertTrue(AuditLog::query()->where('action', 'event.delete')->exists());
        $this->getJson("/api/v1/events/{$second->uuid}")->assertNotFound();
    }

    public function test_reminder_is_sent_once_and_again_after_reschedule(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $soon = $this->event($community, $owner, ['starts_at' => now()->addHours(10)]);
        $this->event($community, $owner, ['starts_at' => now()->addDays(5)]);
        $service = app(ClubEventService::class);

        $this->assertSame(1, $service->dispatchReminders());
        $this->assertSame(0, $service->dispatchReminders());
        Queue::assertPushed(SendClubEventNotificationsJob::class, fn ($job) => $job->kind === 'reminder' && $job->eventId === $soon->id);

        $service->update($soon, ['starts_at' => now()->addHours(20)->toIso8601String()]);
        $this->assertSame(1, $service->dispatchReminders());
    }

    public function test_nightly_job_cancels_events_of_deleted_communities(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $event = $this->event($community, $owner);
        $community->delete();

        $this->artisan('events:cancel-orphaned')->assertSuccessful();

        $this->assertSame('cancelled', $event->fresh()->status);
        Queue::assertPushed(SendClubEventNotificationsJob::class, fn ($job) => $job->kind === 'cancelled');
    }

    public function test_notification_job_reaches_members_but_not_author_or_muted(): void
    {
        Queue::fake([]);
        $owner = $this->user();
        $community = $this->community($owner);
        $member = $this->joinedUser($community);
        $muted = $this->joinedUser($community);
        $community->members()->updateExistingPivot($muted->id, ['notifications_enabled' => false]);
        $event = $this->event($community, $owner);

        (new SendClubEventNotificationsJob($event->id, SendClubEventNotificationsJob::PUBLISHED))->handle();

        $this->assertSame(1, $member->notifications()->count());
        $this->assertSame(0, $owner->notifications()->count());
        $this->assertSame(0, $muted->notifications()->count());
        $this->assertSame('/events/'.$event->uuid, $member->notifications()->first()->data['link']);
    }

    public function test_admin_lists_all_events_with_filters(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $this->event($community, $owner);
        $this->event($community, $owner, ['starts_at' => now()->subDay()]);
        Sanctum::actingAs($this->user(UserRole::Owner));

        $this->getJson('/api/v1/admin/events')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson("/api/v1/admin/events?community={$community->slug}&status=past")->assertOk()->assertJsonPath('meta.total', 1);
        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/admin/events')->assertForbidden();
    }

    // ── помощники ───────────────────────────────────────────────────────────

    private function user(UserRole $role = UserRole::User): User
    {
        return User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
    }

    private function community(User $owner, string $access = 'open'): Community
    {
        $category = CommunityCategory::query()->create([
            'name' => 'Категория', 'slug' => 'cat-'.Str::random(8), 'sort_order' => 1, 'depth' => 0, 'is_active' => true,
        ]);
        $community = Community::query()->create([
            'category_id' => $category->id,
            'name' => 'Клуб '.Str::random(5),
            'slug' => 'club-'.Str::random(8),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'access_type' => $access,
            'members_count' => 1,
        ]);
        $community->members()->attach($owner->id, ['role' => CommunityMemberRole::Owner->value, 'joined_at' => now()]);

        return $community;
    }

    private function joinedUser(Community $community): User
    {
        $user = $this->user();
        $community->members()->attach($user->id, ['role' => CommunityMemberRole::Member->value, 'joined_at' => now()]);

        return $user;
    }

    /** @param  array<string, mixed>  $over */
    private function event(Community $community, User $owner, array $over = []): ClubEvent
    {
        return ClubEvent::query()->create([
            'scope' => ClubEvent::SCOPE_COMMUNITY,
            'status' => ClubEvent::STATUS_PUBLISHED,
            'community_id' => $community->id,
            'created_by' => $owner->id,
            'title' => 'Встреча '.Str::random(4),
            'starts_at' => now()->addDays(random_int(1, 30)),
            ...$over,
        ]);
    }
}
