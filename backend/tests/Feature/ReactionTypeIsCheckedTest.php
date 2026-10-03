<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserStatus;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\PostReaction;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Тип реакции проверяется правилом, а не колонкой базы.
 *
 * Аудит 03.10: `POST /posts/{uuid}/react` брал `$request->string('type')` без
 * списка значений и отдавал в `firstOrCreate`. Из этого выходило два следствия,
 * и проверяются оба:
 *
 *   1. Произвольный тип оказывался в данных и отрисовывался всем, кто
 *      открывал запись.
 *   2. Строка длиннее колонки (`post_reactions.type varchar(32)`,
 *      `comment_reactions.type varchar(16)`) доходила до `INSERT`, Postgres
 *      отвечал `value too long`, а человек получал 500 вместо 422.
 *
 * Длина здесь важнее, чем кажется: правило `Rule::in` закрывает оба случая
 * сразу, поэтому отдельного `max:` не нужно — но без проверки это утверждение
 * ничем не держится.
 */
class ReactionTypeIsCheckedTest extends TestCase
{
    use RefreshDatabase;

    public function test_известный_тип_принимается(): void
    {
        [$читатель, $запись] = $this->записьИЧитатель();

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/posts/{$запись->uuid}/react", ['type' => 'like'])
            ->assertOk();

        $this->assertSame('like', PostReaction::query()->firstOrFail()->type);
    }

    public function test_без_типа_ставится_одобрение(): void
    {
        [$читатель, $запись] = $this->записьИЧитатель();

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/posts/{$запись->uuid}/react")
            ->assertOk();

        $this->assertSame('like', PostReaction::query()->firstOrFail()->type);
    }

    public function test_неизвестный_тип_отклоняется_и_в_данные_не_попадает(): void
    {
        [$читатель, $запись] = $this->записьИЧитатель();

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/posts/{$запись->uuid}/react", ['type' => 'дизлайк'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('type');

        $this->assertSame(0, PostReaction::query()->count());
    }

    /**
     * Длинная строка — 422, а не 500.
     *
     * Сорок символов против колонки `varchar(32)`: до правки это был
     * `QueryException` из Postgres, то есть пятисотый на действие читателя.
     */
    public function test_строка_длиннее_колонки_даёт_422_а_не_500(): void
    {
        [$читатель, $запись] = $this->записьИЧитатель();

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/posts/{$запись->uuid}/react", ['type' => str_repeat('я', 40)])
            ->assertStatus(422);

        $this->assertSame(0, PostReaction::query()->count());
    }

    public function test_у_комментария_то_же_правило(): void
    {
        [$читатель, $запись] = $this->записьИЧитатель();

        $комментарий = $запись->comments()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $читатель->id,
            'body' => 'Комментарий',
            'status' => 'published',
        ]);

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/comments/{$комментарий->uuid}/react", ['type' => str_repeat('я', 40)])
            ->assertStatus(422);
    }

    /** @return array{0: User, 1: Post} */
    private function записьИЧитатель(): array
    {
        $автор = $this->человек();
        $читатель = $this->человек();

        $категория = PostCategory::query()->create([
            'name' => 'Проверка',
            'slug' => 'check-'.uniqid(),
            'sort_order' => 1,
        ]);

        $запись = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $автор->id,
            'category_id' => $категория->id,
            'title' => 'Запись для реакций',
            'body' => 'Тело записи',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        return [$читатель, $запись];
    }

    private function человек(): User
    {
        $человек = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        UserProfile::create([
            'user_id' => $человек->id,
            'display_name' => 'Человек '.$человек->id,
            'slug' => 'chelovek-'.$человек->id.'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $человек;
    }
}
