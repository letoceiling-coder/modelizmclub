<?php

namespace Tests\Feature\Chat;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\PostCategory;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\Chat\Services\ChatService;
use Tests\Feature\Policies\PolicyFixtures;
use Tests\TestCase;

/**
 * Страница комнаты спрашивает беседу и участников параллельно. Оба запроса
 * читали «участника нет» и оба вставляли — второй падал на уникальном ключе
 * с 500 (прод, 15.09, rooms/157/conversation).
 *
 * Параллельный запрос здесь изображён вставкой той же строки сразу после
 * чтения: ровно то окно, в которое попадал второй запрос.
 */
class CategoryRoomJoinRaceTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_participant_inserted_between_read_and_write_does_not_fail(): void
    {
        [$parent, $sub] = $this->seedRoomCategories();
        $user = $this->seedUser('race');
        $room = Conversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => ConversationType::Room,
            'post_category_id' => $sub->id,
            'title' => $sub->name,
        ]);

        $this->insertOnceAfterSelect('conversation_participants', function () use ($room, $user): void {
            DB::table('conversation_participants')->insert([
                'conversation_id' => $room->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $conversation = app(ChatService::class)->findOrCreateCategoryRoom($parent->id, $sub->id, $user);

        $this->assertSame($room->id, $conversation->id);
        $this->assertSame(1, ConversationParticipant::query()
            ->where('conversation_id', $room->id)->where('user_id', $user->id)->count());
    }

    public function test_room_created_between_read_and_write_does_not_fail(): void
    {
        [$parent, $sub] = $this->seedRoomCategories();
        $user = $this->seedUser('race-room');

        $this->insertOnceAfterSelect('conversations', function () use ($sub): void {
            DB::table('conversations')->insert([
                'uuid' => (string) Str::uuid(),
                'type' => ConversationType::Room->value,
                'post_category_id' => $sub->id,
                'title' => $sub->name,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $conversation = app(ChatService::class)->findOrCreateCategoryRoom($parent->id, $sub->id, $user);

        $this->assertSame(1, Conversation::query()
            ->where('type', ConversationType::Room)->where('post_category_id', $sub->id)->count());
        $this->assertTrue(ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)->where('user_id', $user->id)->exists());
    }

    public function test_left_participant_rejoins_on_visit(): void
    {
        [$parent, $sub] = $this->seedRoomCategories();
        $user = $this->seedUser('left');
        $room = app(ChatService::class)->findOrCreateCategoryRoom($parent->id, $sub->id, $user);
        ConversationParticipant::query()->where('conversation_id', $room->id)
            ->where('user_id', $user->id)->update(['left_at' => now()]);

        app(ChatService::class)->findOrCreateCategoryRoom($parent->id, $sub->id, $user);

        $this->assertNull(ConversationParticipant::query()->where('conversation_id', $room->id)
            ->where('user_id', $user->id)->value('left_at'));
    }

    /** @return array{0: PostCategory, 1: PostCategory} */
    private function seedRoomCategories(): array
    {
        $slug = Str::random(6);
        $parent = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => "aviation-{$slug}", 'sort_order' => 1,
            'depth' => 0, 'path' => "aviation-{$slug}", 'is_active' => true,
        ]);
        $sub = PostCategory::query()->create([
            'parent_id' => $parent->id, 'name' => 'Вертолёты', 'slug' => "helicopters-{$slug}",
            'sort_order' => 1, 'depth' => 1, 'path' => "aviation-{$slug}/helicopters-{$slug}", 'is_active' => true,
        ]);

        return [$parent, $sub];
    }

    /** Один раз после первого чтения из таблицы выполняет «встречную» вставку. */
    private function insertOnceAfterSelect(string $table, \Closure $insert): void
    {
        $done = false;
        Event::listen(QueryExecuted::class, function (QueryExecuted $query) use (&$done, $table, $insert): void {
            if ($done || ! str_starts_with(ltrim($query->sql), 'select') || ! str_contains($query->sql, "\"{$table}\"")) {
                return;
            }
            $done = true;
            $insert();
        });
    }
}
