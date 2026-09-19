<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Просмотр — фактическое открытие записи, один раз в сутки на читателя, и один
 * счётчик у записи канала и её зеркала в ленте.
 *
 * Разбор 17.09 на проде, «под всеми публикациями 23»: у шести записей канала
 * «Мастерская: короткие заметки» по 23 просмотра, у пяти «Авиамоделизма
 * сегодня» по 106, у пяти «Брони и диорам» по 1. Страница канала засчитывала
 * просмотр каждой отрисованной записи — открыл канал, и все записи получили
 * по одному. У тех же записей «Мастерской» в ленте было 8: зеркало вело свой
 * счётчик с дедупликацией по IP на шесть часов, а чтение в ленте до канала не
 * доходило. Администратор площадки (508) до 30d5c7f3 считался командой
 * канала — ни одной строки u:508 в книге.
 */
class ChannelPostViewsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Channel $channel;

    protected function setUp(): void
    {
        parent::setUp();
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

    /** Открыть запись: страница записи или окно с полной записью. */
    private function open(string $uuid, ?User $as, ?string $guest = 'guest-aaaa-0001')
    {
        $request = $as ? $this->actingAs($as, 'sanctum') : $this;
        $response = $request->withHeaders($guest === null ? [] : ['X-Guest-Viewer' => $guest])
            ->postJson("/api/v1/posts/{$uuid}/view")
            ->assertOk();
        $this->app['auth']->forgetGuards();

        return $response;
    }

    private function openInFeed(Post $post, ?User $as, ?string $guest = 'guest-aaaa-0001')
    {
        return $this->open($post->uuid, $as, $guest);
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

        $this->viewInChannel($channelPost, $this->user(UserRole::Owner))->assertJsonPath('data.counted', true);
        $this->viewInChannel($channelPost, $this->user(UserRole::Moderator))->assertJsonPath('data.counted', true);

        $this->assertViews(2, $channelPost, $feedPost);
    }

    public function test_reading_the_mirror_in_feed_counts_on_the_channel_post(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->openInFeed($feedPost, $this->user())->assertJsonPath('data.views', 1);

        $this->assertViews(1, $channelPost, $feedPost);
    }

    public function test_same_reader_in_channel_and_feed_is_one_view(): void
    {
        [$channelPost, $feedPost] = $this->publish();
        $reader = $this->user();

        $this->viewInChannel($channelPost, $reader)->assertJsonPath('data.views', 1);
        $this->openInFeed($feedPost, $reader);
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

        $this->openInFeed($feedPost, $this->owner);
        $this->openInFeed($feedPost, $channelAdmin);
        $this->viewInChannel($channelPost, $channelAdmin)->assertJsonPath('data.counted', false);

        $this->assertViews(0, $channelPost, $feedPost);
    }

    /**
     * Запрос без заголовка, куки и сессии (у api-группы её нет): ключ гостя
     * строится из адреса, а не падает на session() с 500.
     */
    public function test_guest_request_without_any_identity_does_not_fail(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->openInFeed($feedPost, null, null);
        $this->openInFeed($feedPost, null, null);

        $this->assertViews(1, $channelPost, $feedPost);
    }

    public function test_plain_feed_post_keeps_its_own_counter(): void
    {
        $author = $this->user();
        $post = $this->plainPost($author);

        $this->openInFeed($post, $this->user());
        $this->openInFeed($post, $author);

        $this->assertSame(1, (int) $post->fresh()->views_count);
    }

    /** Серверная отрисовка страницы записи и любой другой GET просмотр не засчитывают. */
    public function test_reading_post_or_channel_list_does_not_count(): void
    {
        [$channelPost, $feedPost] = $this->publish();

        $this->getJson("/api/v1/posts/{$feedPost->uuid}")->assertOk();
        $this->getJson("/api/v1/channels/{$this->channel->slug}/posts")->assertOk();
        $this->actingAs($this->user(), 'sanctum')->getJson("/api/v1/posts/{$feedPost->uuid}")->assertOk();

        $this->assertViews(0, $channelPost, $feedPost);
    }

    public function test_one_view_per_reader_per_day(): void
    {
        [$channelPost, $feedPost] = $this->publish();
        $reader = $this->user();

        $this->openInFeed($feedPost, $reader)->assertJsonPath('data.counted', true);
        $this->openInFeed($feedPost, $reader)->assertJsonPath('data.counted', false);
        $this->viewInChannel($channelPost, $reader)->assertJsonPath('data.counted', false);
        $this->assertViews(1, $channelPost, $feedPost);

        $this->travel(1)->days();
        $this->openInFeed($feedPost, $reader)->assertJsonPath('data.counted', true);
        $this->openInFeed($feedPost, $reader)->assertJsonPath('data.counted', false);
        $this->assertViews(2, $channelPost, $feedPost);
    }

    public function test_plain_post_counts_guests_by_their_id_once_a_day(): void
    {
        $author = $this->user();
        $post = $this->plainPost($author);

        $this->open($post->uuid, null, 'guest-aaaa-0001')->assertJsonPath('data.counted', true);
        $this->open($post->uuid, null, 'guest-aaaa-0001')->assertJsonPath('data.counted', false);
        // Тот же адрес, другой гость: до 17.09 ключом был IP, и это был бы ноль.
        $this->open($post->uuid, null, 'guest-bbbb-0002')->assertJsonPath('data.views', 2);

        $this->travel(1)->days();
        $this->open($post->uuid, null, 'guest-aaaa-0001')->assertJsonPath('data.views', 3);
    }

    public function test_channel_post_without_mirror_is_opened_by_its_own_id(): void
    {
        [$channelPost, $feedPost] = $this->publish();
        $channelPost->forceFill(['feed_post_id' => null])->save();

        $this->open($channelPost->uuid, $this->user())->assertJsonPath('data.views', 1);

        $this->assertSame(1, (int) $channelPost->fresh()->views_count);
        $this->assertSame(0, (int) $feedPost->fresh()->views_count);
    }

    public function test_unknown_or_hidden_post_is_404(): void
    {
        $this->postJson('/api/v1/posts/00000000-0000-4000-8000-000000000000/view')->assertNotFound();

        [$channelPost] = $this->publish();
        $channelPost->forceFill(['feed_post_id' => null, 'status' => 'pending'])->save();
        $this->postJson("/api/v1/posts/{$channelPost->uuid}/view")->assertNotFound();
    }

    private function plainPost(User $author): Post
    {
        return Post::query()->create([
            'user_id' => $author->id,
            'title' => 'Пост',
            'body' => 'Текст',
            'status' => 'published',
            'published_at' => now(),
            'category_id' => PostCategory::query()->create(['name' => 'А', 'slug' => 'a-'.uniqid(), 'is_active' => true])->id,
        ]);
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
