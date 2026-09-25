<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ClubEvent;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Modules\Community\Jobs\SendClubEventNotificationsJob;
use Modules\Community\Services\ClubEventService;
use Tests\TestCase;

/**
 * Кнопка «напомнить» у организатора (C7).
 *
 * Автоматическое напоминание за сутки, отмена и удаление с уведомлением
 * участникам уже работали; здесь — ручная рассылка и её границы.
 */
class EventManualReminderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function человек(UserRole $role = UserRole::User): User
    {
        return User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
    }

    private function сообщество(User $owner): Community
    {
        $category = CommunityCategory::query()->create([
            'name' => 'Категория', 'slug' => 'cat-'.Str::random(8),
            'sort_order' => 1, 'depth' => 0, 'is_active' => true,
        ]);
        $community = Community::query()->create([
            'category_id' => $category->id,
            'name' => 'Клуб '.Str::random(5),
            'slug' => 'club-'.Str::random(8),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'access_type' => 'open',
            'members_count' => 1,
        ]);
        $community->members()->attach($owner->id, ['role' => CommunityMemberRole::Owner->value, 'joined_at' => now()]);

        return $community;
    }

    private function мероприятие(Community $community, User $owner, array $over = []): ClubEvent
    {
        return ClubEvent::query()->create([
            'scope' => ClubEvent::SCOPE_COMMUNITY,
            'status' => ClubEvent::STATUS_PUBLISHED,
            'community_id' => $community->id,
            'created_by' => $owner->id,
            'title' => 'Встреча '.Str::random(4),
            'starts_at' => now()->addDays(5),
            ...$over,
        ]);
    }

    private function сОтметившимся(ClubEvent $event): User
    {
        $гость = $this->человек();
        $event->attendees()->attach($гость->id, ['created_at' => now()]);

        return $гость;
    }

    public function test_организатор_напоминает_и_задача_ставится_в_очередь(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);
        $this->сОтметившимся($event);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();

        Queue::assertPushed(
            SendClubEventNotificationsJob::class,
            fn ($job) => $job->eventId === $event->id
                && $job->kind === SendClubEventNotificationsJob::REMINDER,
        );
    }

    /**
     * Главное: ручное напоминание не съедает автоматическое.
     *
     * Организатор, напомнивший за пять дней, не должен лишить участников
     * напоминания накануне — самого нужного.
     */
    public function test_ручное_напоминание_не_гасит_автоматическое(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner, ['starts_at' => now()->addDays(5)]);
        $this->сОтметившимся($event);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();

        $this->assertNull($event->fresh()->reminder_sent_at, 'ручное напоминание пометило автоматическое как отправленное');

        // Наступили сутки до начала — автоматическое должно уйти.
        $event->forceFill(['starts_at' => now()->addHours(12)])->save();
        $this->assertSame(1, app(ClubEventService::class)->dispatchReminders());
        $this->assertNotNull($event->fresh()->reminder_sent_at);
    }

    public function test_повторное_напоминание_слишком_рано_отклоняется(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);
        $this->сОтметившимся($event);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();

        $ответ = $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertStatus(422);
        $this->assertSame('too_soon', $ответ->json('reason'));
        $this->assertNotNull($ответ->json('next_at'), 'человеку не сказано, когда можно снова');
    }

    public function test_после_выдержки_напомнить_можно_снова(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner, ['starts_at' => now()->addDays(20)]);
        $this->сОтметившимся($event);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();

        Carbon::setTestNow(now()->addHours(ClubEventService::MANUAL_REMINDER_COOLDOWN_HOURS + 1));
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();
        Carbon::setTestNow();
    }

    public function test_некому_напоминать_если_никто_не_отметился(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);

        Sanctum::actingAs($owner);
        $ответ = $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertStatus(422);

        $this->assertSame('no_attendees', $ответ->json('reason'));
        Queue::assertNotPushed(SendClubEventNotificationsJob::class);
    }

    public function test_посторонний_напомнить_не_может(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);
        $чужой = $this->сОтметившимся($event);

        Sanctum::actingAs($чужой);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertForbidden();

        Queue::assertNotPushed(SendClubEventNotificationsJob::class);
    }

    public function test_по_отменённому_и_прошедшему_напомнить_нельзя(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);

        $отменённое = $this->мероприятие($community, $owner, ['status' => ClubEvent::STATUS_CANCELLED]);
        $this->сОтметившимся($отменённое);

        $прошедшее = $this->мероприятие($community, $owner, ['starts_at' => now()->subDay()]);
        $this->сОтметившимся($прошедшее);

        Sanctum::actingAs($owner);

        // 422 с объяснением, а не 403: организатор — это он, дело во
        // времени и состоянии, и ответ должен говорить именно о них.
        $this->postJson("/api/v1/events/{$отменённое->uuid}/remind")
            ->assertStatus(422)
            ->assertJsonPath('reason', 'not_published');
        $this->postJson("/api/v1/events/{$прошедшее->uuid}/remind")
            ->assertStatus(422)
            ->assertJsonPath('reason', 'past');
    }

    /**
     * Главное про текст: напоминание за пять дней не должно говорить
     * «Завтра».
     *
     * «Завтра» было записано в заголовок намертво — напоминание слал
     * только сторож за сутки. С кнопкой то же уведомление уходит и за
     * пять дней, и сказало бы людям неверный день.
     */
    public function test_заголовок_напоминания_зависит_от_расстояния_до_события(): void
    {
        Queue::fake([]);
        $owner = $this->человек();
        $community = $this->сообщество($owner);

        foreach ([
            [now()->addDays(5), 'Напоминание: '],
            [now()->addDay()->setTime(12, 0), 'Завтра: '],
            [now()->addHours(2), 'Сегодня: '],
        ] as [$когда, $ожидаем]) {
            $event = $this->мероприятие($community, $owner, ['starts_at' => $когда, 'title' => 'Встреча']);
            $гость = $this->сОтметившимся($event);

            (new SendClubEventNotificationsJob($event->id, SendClubEventNotificationsJob::REMINDER))->handle();

            $последнее = DB::table('notifications')
                ->where('notifiable_id', $гость->id)
                ->orderByDesc('created_at')
                ->first();
            $this->assertNotNull($последнее, 'уведомление не дошло до отметившегося');
            $данные = json_decode((string) $последнее->data, true);
            $this->assertStringStartsWith(
                $ожидаем,
                (string) ($данные['title'] ?? ''),
                'заголовок не соответствует расстоянию до события',
            );
        }
    }

    /**
     * Напомнили в сутки до начала — сторож не должен прислать то же
     * самое второй раз через полчаса.
     */
    public function test_ручное_внутри_суток_гасит_автоматическое(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner, ['starts_at' => now()->addHours(20)]);
        $this->сОтметившимся($event);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();

        $this->assertNotNull($event->fresh()->reminder_sent_at);
        $this->assertSame(0, app(ClubEventService::class)->dispatchReminders());
    }

    /** Две одновременные попытки ставят задачу один раз, а не две. */
    public function test_одновременные_нажатия_не_рассылают_дважды(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);
        $this->сОтметившимся($event);

        $сервис = app(ClubEventService::class);
        // Две копии одной строки, как две параллельные обработки запроса:
        // обе видят пустую колонку до записи.
        $первый = ClubEvent::query()->findOrFail($event->id);
        $второй = ClubEvent::query()->findOrFail($event->id);

        $a = $сервис->remindNow($первый);
        $b = $сервис->remindNow($второй);

        $this->assertTrue($a['sent']);
        $this->assertFalse($b['sent'], 'вторая попытка тоже разослала');
        $this->assertSame('too_soon', $b['reason']);
        Queue::assertPushed(SendClubEventNotificationsJob::class, 1);
    }

    public function test_напоминание_уходит_только_отметившимся(): void
    {
        Queue::fake([]);
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);

        $отметившийся = $this->сОтметившимся($event);
        $простоУчастник = $this->человек();
        $community->members()->attach($простоУчастник->id, [
            'role' => CommunityMemberRole::Member->value, 'joined_at' => now(),
        ]);

        (new SendClubEventNotificationsJob($event->id, SendClubEventNotificationsJob::REMINDER))->handle();

        $this->assertSame(1, DB::table('notifications')->where('notifiable_id', $отметившийся->id)->count());
        $this->assertSame(0, DB::table('notifications')->where('notifiable_id', $простоУчастник->id)->count());
        $this->assertSame(0, DB::table('notifications')->where('notifiable_id', $owner->id)->count());
    }

    public function test_по_мероприятию_площадки_напоминает_владелец_площадки(): void
    {
        $владелец = $this->человек(UserRole::Owner);
        $event = ClubEvent::query()->create([
            'scope' => ClubEvent::SCOPE_PLATFORM,
            'status' => ClubEvent::STATUS_PUBLISHED,
            'created_by' => $владелец->id,
            'title' => 'Выставка',
            'starts_at' => now()->addDays(4),
        ]);
        $гость = $this->сОтметившимся($event);

        Sanctum::actingAs($гость);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertForbidden();

        Sanctum::actingAs($владелец);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();
    }

    /**
     * Модерация площадки отменяет и удаляет чужое мероприятие, но не
     * рассылает от его имени: решать, когда тревожить людей, должен тот,
     * кто мероприятие ведёт.
     */
    public function test_модератор_площадки_чужому_мероприятию_не_напоминает(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);
        $this->сОтметившимся($event);

        Sanctum::actingAs($this->человек(UserRole::Moderator));
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertForbidden();
    }

    public function test_черновику_отвечают_что_он_не_опубликован(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner, ['status' => ClubEvent::STATUS_DRAFT]);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")
            ->assertStatus(422)
            ->assertJsonPath('reason', 'not_published');
    }

    public function test_напоминание_попадает_в_журнал(): void
    {
        $owner = $this->человек();
        $community = $this->сообщество($owner);
        $event = $this->мероприятие($community, $owner);
        $this->сОтметившимся($event);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/events/{$event->uuid}/remind")->assertOk();

        $this->assertSame(1, DB::table('audit_logs')->where('action', 'event.remind')->count());
    }
}
