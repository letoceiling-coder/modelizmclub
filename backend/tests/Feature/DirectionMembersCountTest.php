<?php

namespace Tests\Feature;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Catalog\Services\CatalogService;
use Tests\TestCase;

/**
 * Сколько людей в направлении.
 *
 * До этого число на витрине направлений бралось из другой сущности:
 * `members` собирался как `includeListingsCount ? listings_count : 0`, а на
 * самой витрине флаг не ставился — значит у всех пятнадцати направлений
 * всегда стоял ноль. Врало не число, а то, из чего оно считалось.
 *
 * Теперь считаются люди в чатах: у направления своего чата нет, чат есть у
 * комнаты, поэтому люди направления — это люди его комнат. Объединением, а
 * не суммой.
 */
class DirectionMembersCountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        CatalogService::flushCache();
    }

    private function direction(string $slug): PostCategory
    {
        return PostCategory::create([
            'parent_id' => null,
            'name' => mb_strtoupper($slug),
            'slug' => $slug,
            'sort_order' => 10,
            'depth' => 0,
            'path' => $slug,
            'is_active' => true,
        ]);
    }

    private function room(PostCategory $parent, string $slug): PostCategory
    {
        return PostCategory::create([
            'parent_id' => $parent->id,
            'name' => mb_strtoupper($slug),
            'slug' => $slug,
            'sort_order' => 10,
            'depth' => 1,
            'path' => $parent->slug.'/'.$slug,
            'is_active' => true,
        ]);
    }

    /** @param list<User> $users */
    private function seatIn(PostCategory $room, array $users, ?User $left = null): void
    {
        $conversation = Conversation::create([
            'type' => ConversationType::Room,
            'post_category_id' => $room->id,
            'title' => $room->name,
            'last_message_at' => now(),
        ]);

        foreach ($users as $user) {
            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        if ($left !== null) {
            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $left->id,
                'role' => 'member',
                'joined_at' => now()->subDay(),
                'left_at' => now(),
            ]);
        }
    }

    /** @return array<int, array<string, mixed>> id узла → узел */
    private function nodesBySlug(): array
    {
        CatalogService::flushCache();
        $tree = app(CatalogService::class)->postCategoryTree();

        $flat = [];
        $walk = function (array $nodes) use (&$walk, &$flat): void {
            foreach ($nodes as $node) {
                $flat[$node['slug']] = $node;
                $walk($node['children'] ?? []);
            }
        };
        $walk($tree);

        return $flat;
    }

    public function test_участники_направления_это_люди_его_комнат(): void
    {
        $aviation = $this->direction('aviation');
        $wwii = $this->room($aviation, 'wwii');

        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->seatIn($wwii, [$a, $b]);

        $nodes = $this->nodesBySlug();
        $this->assertSame(2, $nodes['wwii']['members_count']);
        $this->assertSame(2, $nodes['aviation']['members_count']);
    }

    public function test_один_человек_в_двух_комнатах_считается_один_раз(): void
    {
        $aviation = $this->direction('aviation');
        $wwii = $this->room($aviation, 'wwii');
        $jets = $this->room($aviation, 'jets');

        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->seatIn($wwii, [$a, $b]);
        $this->seatIn($jets, [$a]);

        $nodes = $this->nodesBySlug();
        $this->assertSame(2, $nodes['wwii']['members_count']);
        $this->assertSame(1, $nodes['jets']['members_count']);
        // Сумма дала бы три; людей двое.
        $this->assertSame(2, $nodes['aviation']['members_count']);
    }

    public function test_вышедший_из_комнаты_не_считается(): void
    {
        $aviation = $this->direction('aviation');
        $wwii = $this->room($aviation, 'wwii');

        $stayed = User::factory()->create();
        $left = User::factory()->create();
        $this->seatIn($wwii, [$stayed], $left);

        $nodes = $this->nodesBySlug();
        $this->assertSame(1, $nodes['wwii']['members_count']);
        $this->assertSame(1, $nodes['aviation']['members_count']);
    }

    public function test_направление_без_комнат_показывает_ноль(): void
    {
        $this->direction('workshop');

        $nodes = $this->nodesBySlug();
        // Ноль — законное состояние, а не признак поломки: в мастерской
        // просто ещё никто не сидит.
        $this->assertSame(0, $nodes['workshop']['members_count']);
    }

    public function test_счётчик_приходит_в_публичном_дереве(): void
    {
        $aviation = $this->direction('aviation');
        $wwii = $this->room($aviation, 'wwii');
        $this->seatIn($wwii, [User::factory()->create()]);
        CatalogService::flushCache();

        // Витрина направлений открыта гостю — значит и число должно
        // приходить без токена.
        $this->getJson('/api/v1/categories/posts')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'aviation')
            ->assertJsonPath('data.0.members_count', 1)
            ->assertJsonPath('data.0.children.0.members_count', 1);
    }
}
