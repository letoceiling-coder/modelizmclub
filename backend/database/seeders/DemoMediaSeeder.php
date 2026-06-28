<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\Listing;
use App\Models\ListingMedia;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Post;
use App\Models\PostMedia;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\DemoImageFactory;
use Illuminate\Database\Seeder;
use Modules\Media\Services\MediaUploadService;

class DemoMediaSeeder extends Seeder
{
    public function run(): void
    {
        if (! extension_loaded('gd')) {
            $this->command?->warn('GD extension missing — demo media seed skipped.');

            return;
        }

        $uploads = app(MediaUploadService::class);
        $demo = User::query()->where('email', 'demo@modelizmclub.ru')->first();
        $admin = User::query()->where('email', 'admin@modelizmclub.ru')->first();

        if (! $demo) {
            return;
        }

        $this->seedAvatars($uploads, array_filter([$demo, $admin]));
        $this->seedPostPhotos($uploads, $demo);
        $this->seedBanners($uploads, $demo);
        $this->seedListingPhotos($uploads, $demo);
        $this->seedChatPhotos($uploads, $demo, $admin);
    }

    /** @param  list<User>  $users */
    private function seedAvatars(MediaUploadService $uploads, array $users): void
    {
        foreach ($users as $user) {
            $profile = UserProfile::query()->where('user_id', $user->id)->first();
            if (! $profile || $profile->avatar_media_id) {
                continue;
            }

            $name = $profile->display_name ?: $user->name;
            $media = DemoImageFactory::upload($user, $uploads, "Avatar: {$name}", 'avatar');
            $profile->update(['avatar_media_id' => $media->id]);
        }
    }

    private function seedPostPhotos(MediaUploadService $uploads, User $author): void
    {
        Post::query()
            ->where('user_id', $author->id)
            ->orderBy('id')
            ->each(function (Post $post) use ($uploads, $author): void {
                if ($post->mediaItems()->exists()) {
                    return;
                }

                $media = DemoImageFactory::upload(
                    $author,
                    $uploads,
                    $post->title ?: 'Post '.$post->uuid,
                    'post',
                );

                PostMedia::query()->create([
                    'post_id' => $post->id,
                    'media_id' => $media->id,
                    'sort_order' => 0,
                    'type' => 'image',
                ]);
            });
    }

    private function seedBanners(MediaUploadService $uploads, User $author): void
    {
        $items = [
            [
                'placement' => 'feed',
                'title' => 'Гонки RC в Краснодаре',
                'text' => 'Открыта регистрация на летний этап. Заявки принимаются до 20 июня — успейте занять место в гриде.',
                'link_url' => '/feed',
                'label' => 'Banner: RC races Krasnodar',
            ],
            [
                'placement' => 'feed',
                'title' => 'Новый завоз LiPo батарей',
                'text' => 'Большой выбор аккумуляторов под любые задачи — от 2S до 6S, проверенные бренды.',
                'link_url' => '/ads',
                'label' => 'Banner: LiPo stock',
            ],
            [
                'placement' => 'feed',
                'title' => 'Слёт авиамоделистов',
                'text' => 'Открытое поле, демо-полёты и swap-meet запчастей. Приходите со своими моделями.',
                'link_url' => '/communities',
                'label' => 'Banner: aviation meetup',
            ],
            [
                'placement' => 'events',
                'title' => 'Чемпионат по дрэг-рейсингу RC',
                'text' => 'Финал сезона уже в эту субботу. Болельщики, пилоты и swap-зона запчастей ждут вас на трассе.',
                'link_url' => '/communities',
                'label' => 'Banner: RC drag championship',
            ],
            [
                'placement' => 'events',
                'title' => 'Выставка масштабных моделей',
                'text' => 'Лучшие сборки сезона, мастер-классы по покраске и встреча с экспертами сообщества.',
                'link_url' => '/feed',
                'label' => 'Banner: scale models expo',
            ],
            [
                'placement' => 'events',
                'title' => 'Открытие сезона судомоделей',
                'text' => 'Запуски на открытой воде, регата и обмен опытом. Приводите свои модели и друзей.',
                'link_url' => '/communities',
                'label' => 'Banner: naval season opening',
            ],
        ];

        foreach ($items as $item) {
            $banner = Banner::query()->firstOrNew([
                'placement' => $item['placement'],
                'title' => $item['title'],
            ]);

            if (! $banner->image_media_id) {
                $media = DemoImageFactory::upload($author, $uploads, $item['label'], 'banner');
                $banner->image_media_id = $media->id;
            }

            $banner->fill([
                'text' => $item['text'],
                'link_url' => $item['link_url'],
                'is_active' => true,
                'starts_at' => now()->subDays(7),
                'ends_at' => now()->addMonths(2),
            ]);
            $banner->save();
        }
    }

    private function seedListingPhotos(MediaUploadService $uploads, User $author): void
    {
        Listing::query()
            ->where('user_id', $author->id)
            ->orderBy('id')
            ->each(function (Listing $listing) use ($uploads, $author): void {
                if ($listing->mediaItems()->exists()) {
                    return;
                }

                $media = DemoImageFactory::upload(
                    $author,
                    $uploads,
                    $listing->title ?: 'Listing '.$listing->uuid,
                    'listing',
                );

                ListingMedia::query()->create([
                    'listing_id' => $listing->id,
                    'media_id' => $media->id,
                    'sort_order' => 0,
                ]);
            });
    }

    private function seedChatPhotos(MediaUploadService $uploads, User $demo, ?User $admin): void
    {
        if (! $admin) {
            return;
        }

        $conversationUuid = '00000000-0000-4000-8000-000000000201';
        $messages = [
            [
                'uuid' => '00000000-0000-4000-8000-000000000304',
                'from' => $admin,
                'body' => 'Вот пример фото из чата — так выглядят вложения.',
                'label' => 'Chat: welcome photo',
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000305',
                'from' => $demo,
                'body' => 'Отлично, фото отображается!',
                'label' => 'Chat: reply photo',
            ],
        ];

        foreach ($messages as $item) {
            $message = Message::query()->firstOrNew(['uuid' => $item['uuid']]);
            if ($message->exists && MessageAttachment::query()->where('message_id', $message->id)->exists()) {
                continue;
            }

            if (! $message->exists) {
                $conversationId = Message::query()
                    ->where('uuid', '00000000-0000-4000-8000-000000000301')
                    ->value('conversation_id');

                if (! $conversationId) {
                    continue;
                }

                $message->fill([
                    'conversation_id' => $conversationId,
                    'user_id' => $item['from']->id,
                    'body' => $item['body'],
                    'type' => 'image',
                    'status' => 'sent',
                    'created_at' => now()->subMinutes(2),
                ]);
                $message->save();
            }

            if (MessageAttachment::query()->where('message_id', $message->id)->exists()) {
                continue;
            }

            // Stored as post media so the public proxy can serve it in <img> tags.
            $media = DemoImageFactory::upload($item['from'], $uploads, $item['label'], 'post');

            MessageAttachment::query()->create([
                'message_id' => $message->id,
                'media_id' => $media->id,
            ]);
        }
    }
}
