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

    public function test_feedback_requires_authentication(): void
    {
        $this->postJson('/api/v1/feedback', ['message' => 'Hi'])
            ->assertUnauthorized();
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
}
