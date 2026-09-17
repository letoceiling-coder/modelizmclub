<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelApplication;
use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\CommunityCategory;
use App\Models\ModerationQueue;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * «Потерянные заявки» — приёмка 17.09.
 *
 * Заявка на сообщество или канал жила в своей таблице и в своём разделе
 * «Заявки», а модератор работает в «Модерации». На проде все 32 рассмотренные
 * заявки рассмотрели Владельцы, ни одной — модератор, а «Автоклуб» (заявка 9)
 * пролежал с 05.09 до 15.09.
 *
 * Обращения и заявки не оповещали сотрудников вовсе: из 15 типов уведомлений за
 * 60 дней сотрудникам как сотрудникам уходили только жалобы (`report`, 30
 * штук). Обращения 6 и 7 висят новыми с 23.08.
 */
class LostRequestsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function headers(User $user): array
    {
        // Sanctum запоминает пользователя первого запроса на весь тест; без
        // сброса второй запрос с другим токеном ушёл бы от имени первого.
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
    }

    private function moderator(): User
    {
        return User::factory()->create(['role' => UserRole::Moderator, 'status' => UserStatus::Active]);
    }

    private function category(): CommunityCategory
    {
        return CommunityCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function pendingQueue(User $staff): array
    {
        return $this->getJson('/api/v1/admin/moderation/queue?status=pending&per_page=100', $this->headers($staff))
            ->assertOk()
            ->json('data');
    }

    // --- Заявки в общей очереди ---

    public function test_community_application_reaches_moderator_common_queue(): void
    {
        $moderator = $this->moderator();
        $applicant = User::factory()->create();
        $category = $this->category();

        $this->postJson('/api/v1/communities/apply', [
            'proposed_name' => 'Пилоты',
            'description' => 'Сообщество пилотажных моделей',
            'category_id' => $category->id,
            'rules' => 'Без рекламы',
            'access_type' => 'request',
        ], $this->headers($applicant))->assertCreated();

        $application = CommunityApplication::query()->where('user_id', $applicant->id)->firstOrFail();

        $items = $this->pendingQueue($moderator);
        $this->assertCount(1, $items, 'заявка на сообщество должна стоять в общей очереди модерации');
        $this->assertSame('CommunityApplication', $items[0]['moderatable_type']);
        $this->assertSame('community_applications', $items[0]['queue']);
        $this->assertSame($application->id, $items[0]['moderatable_id']);
        $this->assertSame('Пилоты', $items[0]['moderatable']['title']);
        $this->assertSame('Авиация', $items[0]['moderatable']['category']['name']);
        $this->assertSame('Сообщество пилотажных моделей', $items[0]['moderatable']['body']);
        $this->assertNotSame('', $items[0]['moderatable']['author']['display_name']);
    }

    public function test_channel_application_reaches_moderator_common_queue(): void
    {
        $moderator = $this->moderator();
        $applicant = User::factory()->create();

        $this->postJson('/api/v1/channels/apply', [
            'name' => 'Броня 1:35',
            'description' => 'Обзоры наборов',
            'category' => 'Бронетехника',
        ], $this->headers($applicant))->assertCreated();

        $items = $this->pendingQueue($moderator);
        $this->assertCount(1, $items, 'заявка на канал должна стоять в общей очереди модерации');
        $this->assertSame('ChannelApplication', $items[0]['moderatable_type']);
        $this->assertSame('channel_applications', $items[0]['queue']);
        $this->assertSame('Броня 1:35', $items[0]['moderatable']['title']);
        $this->assertSame('Бронетехника', $items[0]['moderatable']['category']['name']);
    }

    public function test_moderator_approves_community_application_from_common_queue(): void
    {
        $moderator = $this->moderator();
        $applicant = User::factory()->create();
        $category = $this->category();

        $this->postJson('/api/v1/communities/apply', [
            'proposed_name' => 'Пилоты',
            'category_id' => $category->id,
        ], $this->headers($applicant))->assertCreated();
        $application = CommunityApplication::query()->firstOrFail();

        $this->postJson(
            "/api/v1/admin/moderation/community_applications/{$application->id}/approve",
            [],
            $this->headers($moderator),
        )->assertOk();

        $this->assertSame('approved', $application->fresh()->status->value);
        $this->assertSame($moderator->id, $application->fresh()->reviewed_by);
        $community = Community::query()->where('created_by', $applicant->id)->first();
        $this->assertNotNull($community, 'одобрение из очереди должно создать сообщество');
        $this->assertSame([], $this->pendingQueue($moderator));

        // Решение объявлено заявителю ровно один раз: у заявки своё уведомление,
        // и общее «Сообщество одобрено» из очереди его не дублирует.
        $titles = $applicant->fresh()->notifications->pluck('data.title')->all();
        $this->assertSame(['Заявка на сообщество одобрена'], $titles);
    }

    public function test_moderator_rejects_channel_application_from_common_queue(): void
    {
        $moderator = $this->moderator();
        $applicant = User::factory()->create();

        $this->postJson('/api/v1/channels/apply', ['name' => 'Броня 1:35'], $this->headers($applicant))
            ->assertCreated();
        $application = ChannelApplication::query()->firstOrFail();

        $this->postJson(
            "/api/v1/admin/moderation/channel_applications/{$application->id}/reject",
            ['reason' => 'Название уже занято другим каналом'],
            $this->headers($moderator),
        )->assertOk();

        $fresh = $application->fresh();
        $this->assertSame('rejected', $fresh->status->value);
        $this->assertSame('Название уже занято другим каналом', $fresh->moderator_comment);
        $this->assertFalse(Channel::query()->where('owner_id', $applicant->id)->exists());
        $this->assertSame([], $this->pendingQueue($moderator));
    }

    public function test_application_cannot_be_sent_to_revision(): void
    {
        $moderator = $this->moderator();
        $applicant = User::factory()->create();

        $this->postJson('/api/v1/channels/apply', ['name' => 'Броня 1:35'], $this->headers($applicant))
            ->assertCreated();
        $application = ChannelApplication::query()->firstOrFail();

        $this->postJson(
            "/api/v1/admin/moderation/channel_applications/{$application->id}/revision",
            ['comment' => 'Уточните тематику канала'],
            $this->headers($moderator),
        )->assertStatus(422);

        $this->assertSame('pending', $application->fresh()->status->value);
    }

    public function test_decision_in_applications_section_closes_queue_entry(): void
    {
        $owner = User::factory()->create(['role' => UserRole::Admin]);
        $moderator = $this->moderator();
        $applicant = User::factory()->create();
        $category = $this->category();

        $this->postJson('/api/v1/communities/apply', [
            'proposed_name' => 'Пилоты',
            'category_id' => $category->id,
        ], $this->headers($applicant))->assertCreated();
        $application = CommunityApplication::query()->firstOrFail();

        $this->postJson(
            "/api/v1/admin/communities/applications/{$application->id}/approve",
            [],
            $this->headers($owner),
        )->assertOk();

        $this->assertSame([], $this->pendingQueue($moderator));
        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => CommunityApplication::class,
            'moderatable_id' => $application->id,
            'status' => 'approved',
        ]);
    }

    public function test_pending_application_without_queue_entry_is_picked_up(): void
    {
        // Заявки, поданные до выкатки, строки в очереди не имеют.
        $moderator = $this->moderator();
        $applicant = User::factory()->create();
        $id = DB::table('channel_applications')->insertGetId([
            'user_id' => $applicant->id,
            'proposed_name' => 'Старая заявка',
            'status' => 'pending',
            'comments_enabled' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->assertSame(0, ModerationQueue::query()->count());

        $items = $this->pendingQueue($moderator);

        $this->assertCount(1, $items);
        $this->assertSame($id, $items[0]['moderatable_id']);
    }

    public function test_application_decided_bypassing_models_leaves_queue(): void
    {
        // Решение прямым SQL мимо событий модели очередь не должна пережить.
        $moderator = $this->moderator();
        $applicant = User::factory()->create();

        $this->postJson('/api/v1/channels/apply', ['name' => 'Броня 1:35'], $this->headers($applicant))
            ->assertCreated();
        $application = ChannelApplication::query()->firstOrFail();
        DB::table('channel_applications')->where('id', $application->id)->update(['status' => 'rejected']);

        $this->assertSame([], $this->pendingQueue($moderator));
        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => ChannelApplication::class,
            'moderatable_id' => $application->id,
            'status' => 'rejected',
        ]);
    }

    // --- Сотрудники узнают о новых обращениях и заявках ---

    public function test_new_feedback_notifies_active_staff(): void
    {
        $owner = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $moderator = $this->moderator();
        $blocked = User::factory()->create(['role' => UserRole::Moderator, 'status' => UserStatus::Blocked]);
        $author = User::factory()->create(['status' => UserStatus::Active]);

        $this->postJson('/api/v1/feedback', [
            'subject' => 'Авиация',
            'message' => 'Не подтягивается информация об обзоре',
            'page' => '/reviews',
        ], $this->headers($author))->assertCreated();

        foreach ([$owner, $moderator] as $staff) {
            $note = $staff->fresh()->notifications->first();
            $this->assertNotNull($note, "сотрудник {$staff->id} должен узнать о новом обращении");
            $this->assertSame('Новое обращение', $note->data['title']);
            $this->assertSame('/admin?section=feedback', $note->data['link']);
        }
        $this->assertCount(0, $blocked->fresh()->notifications);
        $this->assertCount(0, $author->fresh()->notifications);
    }

    public function test_new_community_and_channel_applications_notify_staff(): void
    {
        $moderator = $this->moderator();
        $applicant = User::factory()->create();
        $category = $this->category();

        $this->postJson('/api/v1/communities/apply', [
            'proposed_name' => 'Пилоты',
            'category_id' => $category->id,
        ], $this->headers($applicant))->assertCreated();

        $other = User::factory()->create();
        $this->postJson('/api/v1/channels/apply', ['name' => 'Броня 1:35'], $this->headers($other))
            ->assertCreated();

        $notes = $moderator->fresh()->notifications;
        $this->assertCount(2, $notes);
        $this->assertEqualsCanonicalizing(
            ['Заявка на сообщество', 'Заявка на канал'],
            $notes->pluck('data.title')->all(),
        );
        foreach ($notes as $note) {
            $this->assertSame('/admin?section=moderation', $note->data['link']);
        }
    }

    public function test_staff_member_is_not_notified_about_own_feedback(): void
    {
        $owner = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $moderator = $this->moderator();

        $this->postJson('/api/v1/feedback', ['message' => 'тест'], $this->headers($owner))->assertCreated();

        $this->assertCount(0, $owner->fresh()->notifications);
        $this->assertCount(1, $moderator->fresh()->notifications);
    }

    public function test_report_notification_leads_to_moderation_section(): void
    {
        // Жалобы сотрудникам уходили и раньше, но ссылка вела на «/admin» —
        // в дашборд, откуда жалобу ещё надо было искать.
        $moderator = $this->moderator();
        $reporter = User::factory()->create(['status' => UserStatus::Active]);
        $target = User::factory()->create(['status' => UserStatus::Active]);

        $this->postJson('/api/v1/reports', [
            'type' => 'user',
            'target_id' => $target->uuid,
            'reason' => 'spam',
        ], $this->headers($reporter))->assertCreated();

        $note = $moderator->fresh()->notifications->first();
        $this->assertNotNull($note);
        $this->assertSame('Новая жалоба', $note->data['title']);
        $this->assertSame('/admin?section=moderation', $note->data['link']);
    }
}
