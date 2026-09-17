<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Один счётчик просмотров у записи канала и её зеркала в ленте.
 *
 * Разбор 17.09 на проде, канал «Мастерская: короткие заметки»: у шести
 * записей на странице канала 23 просмотра, у тех же записей в ленте — 8.
 * Последний учтённый просмотр 15.09 14:54 МСК, после него страницу канала
 * открывали ещё пять раз (журнал nginx), и счётчик стоял.
 *
 * Причин две. Администратор площадки (508) до 17.09 считался командой канала,
 * и его просмотры не учитывались вовсе — в channel_post_views нет ни одной
 * строки u:508. И чтение той же записи в ленте (/post/{uuid}) шло в
 * posts.views_count с дедупликацией по IP на шесть часов и до счётчика канала
 * не доходило никогда.
 */
class ChannelPostViewsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Channel $channel;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config(['feed.auto_publish' => true]);
        $this->owner = $this->user();
        $this->channel = Channel::create([
            'owner_id' => $this->owner->id,
            'name' => 'Мастерская',
            'slug' => 'workshop-'.uniqid(),
            'kind' => 'author',
            'comments_enabled' => true,
        ]);
    }

    private function user(UserRole $role = UserRole::User): User
    {
        return User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
    }

    /** @return array{0: ChannelPost, 1: Post} */
    private function publish(): array
    {
        $uuid = $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/v1/channels/{$this->channel->slug}/posts", ['text' => 'Запись '.uniqid()])
            ->assertCreated()
            ->json('data.id');
        $this->app['auth']->forgetGuards();

        $channelPost = ChannelPost::query()->where('uuid', $uuid)->firstOrFail();
        $this->assertNotNull($channelPost->feed_post_id, 'у записи канала нет зеркала в ленте');

        return [$channelPost, Post::query()->findOrFail($channelPost->feed_post_id)];
    }

    private function viewInChannel(ChannelPost $post, ?User $as, string $guest = 'guest-aaaa-0001')
    {
        $request = $as ? $this->actingAs($as, 'sanctum') : $this;
        $response = $request->withHeaders(['X-Guest-Viewer' => $guest])
            ->postJson("/api/v1/channels/{$this->channel->slug}/posts/{$post->uuid}/view")
            ->assertOk();
        $this->app['auth']->forgetGuards();

        return $response;
    }

    private function readInFeed(Post $post, ?User $as, array $headers = [])
    {
        $request = $as ? $this->actingAs($as, 'sanctum') : $this;
        $response = $request->withHeaders($headers)->getJson("/api/v1/posts/{$post->uuid}")->assertOk();
        $this->app['auth']->forgetGuards();

        return $response;
    }

    private function assertViews(int $expected, ChannelPost $channelPost, Post $feedPost): void
    {
        $this->assertSame(
            ['канал' => $expected, 'лента' => $expected],
            ['канал' => (int) $channelPost->fresh()->views_count, 'лента' => (int) $feedPost->fresh()->views_count],
        );
    }

    public function test_site_admin_and_moderator_views_count_in_foreign_channel(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->viewInChannel($channelPost, $this->user(UserRole::Admin))->assertJsonPath('data.counted', true);
        $this->viewInChannel($channelPost, $this->user(UserRole::Moderator))->assertJsonPath('data.counted', true);

        $this->assertViews(2, $channelPost, $feedPost);
    }

    public function test_reading_the_mirror_in_feed_counts_on_the_channel_post(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->readInFeed($feedPost, $this->user())->assertJsonPath('data.stats.views', 1);

        $this->assertViews(1, $channelPost, $feedPost);
    }

    public function test_same_reader_in_channel_and_feed_is_one_view(): void
    {
        [$channelPost, $feedPost] = $this->publish();
        $reader = $this->user();

        $this->viewInChannel($channelPost, $reader)->assertJsonPath('data.views', 1);
        $this->readInFeed($feedPost, $reader);
        $this->viewInChannel($channelPost, $reader)->assertJsonPath('data.counted', false);

        $this->assertViews(1, $channelPost, $feedPost);
    }

    /** На проде гости за одним адресом давали ленте один просмотр на шесть часов: 23 в канале, 8 в ленте. */
    public function test_two_guests_behind_one_address_are_two_views_in_both_places(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->viewInChannel($channelPost, null, 'guest-aaaa-0001');
        $this->viewInChannel($channelPost, null, 'guest-bbbb-0002');

        $this->assertViews(2, $channelPost, $feedPost);
    }

    public function test_channel_team_views_are_not_counted_in_feed_either(): void
    {
        [$channelPost, $feedPost] = $this->publish();
        $channelAdmin = $this->user();
        $this->channel->admins()->attach($channelAdmin->id);

        $this->readInFeed($feedPost, $this->owner);
        $this->readInFeed($feedPost, $channelAdmin);
        $this->viewInChannel($channelPost, $channelAdmin)->assertJsonPath('data.counted', false);

        $this->assertViews(0, $channelPost, $feedPost);
    }

    /**
     * Серверная отрисовка страницы записи ходит в API без заголовка, куки и
     * сессии. Ключ гостя тогда строится из адреса, а не падает на session().
     */
    public function test_guest_request_without_any_identity_does_not_fail(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->readInFeed($feedPost, null);
        $this->readInFeed($feedPost, null);

        $this->assertViews(1, $channelPost, $feedPost);
    }

    public function test_plain_feed_post_keeps_its_own_counter(): void
    {
        $author = $this->user();
        $post = Post::query()->create([
            'user_id' => $author->id,
            'title' => 'Пост',
            'body' => 'Текст',
            'status' => 'published',
            'published_at' => now(),
            'category_id' => PostCategory::query()->create(['name' => 'А', 'slug' => 'a-'.uniqid(), 'is_active' => true])->id,
        ]);

        $this->readInFeed($post, $this->user());
        $this->readInFeed($post, $author);

        $this->assertSame(1, (int) $post->fresh()->views_count);
    }

    public function test_resync_brings_the_mirror_up_to_the_channel_ledger(): void
    {
        [$channelPost, $feedPost] = $this->publish();
        $this->viewInChannel($channelPost, null, 'guest-aaaa-0001');
        $this->viewInChannel($channelPost, null, 'guest-bbbb-0002');
        $this->viewInChannel($channelPost, null, 'guest-cccc-0003');
        // Как на проде до починки: в канале 3, в ленте меньше.
        $feedPost->forceFill(['views_count' => 1])->save();

        $this->artisan('counters:resync', ['--dry-run' => true])->assertSuccessful();
        $this->assertSame(1, (int) $feedPost->fresh()->views_count);

        $this->artisan('counters:resync')->assertSuccessful();
        $this->assertViews(3, $channelPost, $feedPost);

        // Больше в ленте — значит, прочитали на странице записи до починки; не теряем.
        $feedPost->forceFill(['views_count' => 5])->save();
        $this->artisan('counters:resync')->assertSuccessful();
        $this->assertSame(5, (int) $feedPost->fresh()->views_count);
    }
}
