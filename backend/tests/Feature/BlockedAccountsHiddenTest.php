<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserStatus;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Заблокированные и удалённые не показываются ни записями, ни участниками.
 *
 * Приёмка 27.09 открыла ленту гостем, и второй записью сверху стояло:
 * «Удалённая учётная запись · QA путь 8 — запись на модерацию · Тестовая
 * запись приёмки 19.09, будет снята». Её не сняли. Всего опубликованных
 * записей от обезличенных учёток нашлось шесть.
 *
 * В комнате «Планеры» из семи участников три были «Удалённая учётная запись»,
 * причём с сохранённым рейтингом 5 и семью сделками — то есть выглядели
 * заслуженными участниками. По всей базе таких участий 159, из них 87 в
 * чатах направлений.
 *
 * Ничего не удаляется, только перестаёт показываться: обезличивание обратимо,
 * удаление — нет.
 */
class BlockedAccountsHiddenTest extends TestCase
{
    use RefreshDatabase;

    private function человек(UserStatus $статус, string $имя): User
    {
        $user = User::factory()->create(['status' => $статус]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.$user->id,
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function запись(User $author, string $title): Post
    {
        $category = PostCategory::query()->firstOrCreate(
            ['slug' => 'aviaciya-proba'],
            ['name' => 'Авиация', 'sort_order' => 1, 'depth' => 0, 'is_active' => true],
        );

        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $category->id,
            'title' => $title,
            'body' => 'Текст записи.',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function test_записи_заблокированных_не_видны_в_ленте(): void
    {
        $живой = $this->человек(UserStatus::Active, 'Живой человек');
        $заблокированный = $this->человек(UserStatus::Blocked, 'Удалённая учётная запись');
        $удалённый = $this->человек(UserStatus::Deleted, 'Удалённая учётная запись');

        $этаВидна = $this->запись($живой, 'Запись живого человека');
        $этаНет = $this->запись($заблокированный, 'QA путь 8 — запись на модерацию');
        $иЭтаНет = $this->запись($удалённый, 'Тестовая запись приёмки');

        $заголовки = collect($this->getJson('/api/v1/feed?per_page=50')->assertOk()->json('data'))
            ->pluck('title')
            ->all();

        $this->assertContains($этаВидна->title, $заголовки, 'запись живого человека обязана быть в ленте');
        $this->assertNotContains(
            $этаНет->title,
            $заголовки,
            'запись заблокированной учётки в ленте показываться не должна',
        );
        $this->assertNotContains($иЭтаНет->title, $заголовки, 'то же для удалённой');
    }

    /**
     * Скрытие не означает удаления: строка записи остаётся в базе.
     *
     * Это важно ровно потому, что обезличивание обратимо — разблокировали
     * учётку, и её записи вернулись сами.
     */
    public function test_записи_остаются_в_базе_и_возвращаются_после_разблокировки(): void
    {
        $заблокированный = $this->человек(UserStatus::Blocked, 'Удалённая учётная запись');
        $запись = $this->запись($заблокированный, 'Запись, которая вернётся');

        $этоЕсть = Post::query()->whereKey($запись->id)->exists();
        $this->assertTrue($этоЕсть, 'запись не должна удаляться — только скрываться');

        $заголовки = fn () => collect($this->getJson('/api/v1/feed?per_page=50')->json('data'))
            ->pluck('title')->all();

        $this->assertNotContains($запись->title, $заголовки());

        $заблокированный->update(['status' => UserStatus::Active]);

        $this->assertContains(
            $запись->title,
            $заголовки(),
            'после разблокировки запись обязана вернуться сама',
        );
    }

    public function test_заблокированные_не_видны_в_участниках_сообщества(): void
    {
        $владелец = $this->человек(UserStatus::Active, 'Владелец');
        $живой = $this->человек(UserStatus::Active, 'Участник живой');
        $заблокированный = $this->человек(UserStatus::Blocked, 'Удалённая учётная запись');

        $категория = CommunityCategory::query()->create([
            'name' => 'По масштабу',
            'slug' => 'po-masstabu-proba',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $сообщество = Community::query()->create([
            'name' => 'Проба',
            'slug' => 'proba-'.uniqid(),
            'description' => 'Описание',
            'category_id' => $категория->id,
            'created_by' => $владелец->id,
            'status' => 'active',
        ]);

        $сообщество->members()->attach($владелец->id, ['role' => 'owner', 'joined_at' => now()]);
        $сообщество->members()->attach($живой->id, ['role' => 'member', 'joined_at' => now()]);
        $сообщество->members()->attach($заблокированный->id, ['role' => 'member', 'joined_at' => now()]);

        $ответ = $this->actingAs($владелец, 'sanctum')
            ->getJson("/api/v1/communities/{$сообщество->slug}/members?per_page=50")
            ->assertOk();

        $имена = collect($ответ->json('data'))
            ->map(fn ($m) => ($m['user'] ?? $m)['display_name'] ?? null)
            ->filter()
            ->all();

        $this->assertContains('Участник живой', $имена);
        $this->assertNotContains(
            'Удалённая учётная запись',
            $имена,
            'заблокированная учётка в списке участников показываться не должна',
        );
    }
}
