<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Feedback;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedbackModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_guest_can_submit_feedback_with_email(): void
    {
        $this->postJson('/api/v1/feedback', [
            'guest_email' => 'guest@example.com',
            'subject' => 'Вопрос',
            'message' => 'Нужна помощь',
            'page' => '/help',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'new');

        $this->assertDatabaseHas('feedback', [
            'user_id' => null,
            'subject' => 'Вопрос',
            'status' => 'new',
        ]);
    }

    public function test_guest_feedback_requires_email(): void
    {
        $this->postJson('/api/v1/feedback', ['message' => 'Hi'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('guest_email');
    }

    public function test_authenticated_user_can_submit_feedback(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/feedback', [
                'subject' => 'Идея',
                'message' => 'Добавьте тёмную тему',
                'page' => '/feed',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'new');

        $this->assertDatabaseHas('feedback', [
            'user_id' => $user->id,
            'subject' => 'Идея',
            'message' => 'Добавьте тёмную тему',
            'page' => '/feed',
            'status' => 'new',
        ]);
    }

    public function test_feedback_requires_message(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/feedback', ['subject' => 'No body'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('message');
    }

    public function test_phone_unverified_user_can_submit_feedback(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => null,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/feedback', [
                'subject' => 'Бронетехника',
                'message' => 'тест',
                'page' => '/feed',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'new');

        $this->assertDatabaseHas('feedback', [
            'user_id' => $user->id,
            'subject' => 'Бронетехника',
            'message' => 'тест',
        ]);
    }

    public function test_feedback_list_requires_moderator(): void
    {
        $user = User::factory()->create(['role' => UserRole::User]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/admin/feedback')
            ->assertForbidden();
    }

    public function test_moderator_can_list_feedback(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        Feedback::query()->create(['message' => 'Первое обращение', 'status' => 'new']);

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/feedback')
            ->assertOk()
            ->assertJsonPath('data.0.message', 'Первое обращение');
    }

    public function test_moderator_can_update_feedback_status(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $feedback = Feedback::query()->create(['message' => 'Решите вопрос', 'status' => 'new']);

        $this->actingAs($moderator, 'sanctum')
            ->patchJson("/api/v1/admin/feedback/{$feedback->id}", ['status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved');

        $this->assertDatabaseHas('feedback', [
            'id' => $feedback->id,
            'status' => 'resolved',
        ]);
    }

    public function test_ответ_модератора_доходит_до_пользователя(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $feedback = Feedback::query()->create([
            'user_id' => $author->id,
            'subject' => 'Авиация',
            'message' => 'Не подтягивается информация',
            'status' => 'new',
        ]);

        $this->actingAs($moderator, 'sanctum')
            ->patchJson("/api/v1/admin/feedback/{$feedback->id}", [
                'reply' => 'Поправили, обновите страницу.',
            ])
            ->assertOk()
            ->assertJsonPath('data.reply', 'Поправили, обновите страницу.')
            ->assertJsonPath('data.notified', true)
            // Ответ закрывает обращение сам: отдельного нажатия «решено» нет.
            ->assertJsonPath('data.status', 'resolved');

        $this->assertDatabaseHas('feedback', [
            'id' => $feedback->id,
            'reply' => 'Поправили, обновите страницу.',
            'replied_by' => $moderator->id,
            'status' => 'resolved',
        ]);

        // Уведомление — единственный способ узнать об ответе: пользователь
        // на страницу обращений сам не заходит.
        $this->assertSame(1, $author->notifications()->count());
        $this->assertSame(
            'Поправили, обновите страницу.',
            $author->notifications()->first()->data['body'] ?? null,
        );

        $this->actingAs($author, 'sanctum')
            ->getJson('/api/v1/users/me/feedback')
            ->assertOk()
            ->assertJsonPath('data.0.reply', 'Поправили, обновите страницу.')
            ->assertJsonPath('data.0.subject', 'Авиация');
    }

    public function test_ответ_гостю_не_шлёт_уведомление(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $feedback = Feedback::query()->create([
            'user_id' => null,
            'message' => 'Email: guest@example.com'."\n\n".'Вопрос',
            'status' => 'new',
        ]);

        $this->actingAs($moderator, 'sanctum')
            ->patchJson("/api/v1/admin/feedback/{$feedback->id}", ['reply' => 'Ответили почтой.'])
            ->assertOk()
            ->assertJsonPath('data.notified', false)
            ->assertJsonPath('data.from_guest', true);
    }

    public function test_ответ_с_явным_статусом_оставляет_обращение_открытым(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $feedback = Feedback::query()->create([
            'user_id' => $author->id,
            'message' => 'Вопрос',
            'status' => 'new',
        ]);

        $this->actingAs($moderator, 'sanctum')
            ->patchJson("/api/v1/admin/feedback/{$feedback->id}", [
                'reply' => 'Уточните, пожалуйста, в каком разделе.',
                'status' => 'read',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'read');
    }

    public function test_пустой_запрос_к_обращению_отклоняется(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $feedback = Feedback::query()->create(['message' => 'Вопрос', 'status' => 'new']);

        $this->actingAs($moderator, 'sanctum')
            ->patchJson("/api/v1/admin/feedback/{$feedback->id}", [])
            ->assertStatus(422);
    }

    public function test_чужие_обращения_в_свой_список_не_попадают(): void
    {
        $mine = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        Feedback::query()->create(['user_id' => $other->id, 'message' => 'Чужое', 'status' => 'new']);
        Feedback::query()->create(['user_id' => $mine->id, 'message' => 'Моё', 'status' => 'new']);

        $this->actingAs($mine, 'sanctum')
            ->getJson('/api/v1/users/me/feedback')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.message', 'Моё');
    }
}
