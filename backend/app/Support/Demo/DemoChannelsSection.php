<?php

namespace App\Support\Demo;

use App\Enums\UserRole;
use App\Models\Channel;
use App\Models\User;
use Modules\Channel\Services\ChannelApplicationService;
use Modules\Channel\Services\ChannelPostService;
use Modules\Feed\Services\CommentService;
use Modules\Media\Services\MediaUploadService;

/**
 * Каналы: обложка, аватар, подписчики, записи; часть — с комментариями.
 *
 * КОММЕНТАРИИ ВЫКЛЮЧЕНЫ НЕ У ВСЕХ. Признак `comments_enabled` меняет и
 * страницу канала, и карточку записи. Половина набора идёт с включёнными
 * комментариями, половина с выключенными — иначе одно из двух состояний
 * никогда не попадёт на экран проверяющего.
 *
 * ПУТЬ — заявка и одобрение, как у сообществ: канал без владельца в
 * `channel_subscribers` ведёт себя не так, как настоящий.
 */
class DemoChannelsSection extends DemoSection
{
    /** @var list<array{name: string, about: string, subs: int, posts: int, comments: bool}> */
    private const ITEMS = [
        ['name' => 'Мастерская: короткие заметки', 'about' => 'Инструмент, приёмы, находки. Коротко и по делу.', 'subs' => 30, 'posts' => 6, 'comments' => true],
        ['name' => 'Авиамоделизм сегодня', 'about' => 'Новинки наборов и обзоры коробок.', 'subs' => 26, 'posts' => 5, 'comments' => true],
        ['name' => 'Броня и диорамы', 'about' => 'Сцены, фактуры, пигменты.', 'subs' => 21, 'posts' => 5, 'comments' => false],
        ['name' => 'Флот: чертежи и находки', 'about' => 'Где искать чертежи и как их читать.', 'subs' => 17, 'posts' => 4, 'comments' => true],
        ['name' => 'Железная дорога: модули', 'about' => 'Стандарты стыковки, ландшафт, электрика.', 'subs' => 14, 'posts' => 4, 'comments' => false],
        ['name' => 'Краски и химия', 'about' => 'Сравнения, разбавители, лаки.', 'subs' => 11, 'posts' => 3, 'comments' => true],
        ['name' => 'Конкурсы и выставки', 'about' => 'Расписание, итоги, фотоотчёты.', 'subs' => 8, 'posts' => 3, 'comments' => false],
        ['name' => 'Начинающему моделисту', 'about' => 'Базовые вещи без снисходительности.', 'subs' => 6, 'posts' => 3, 'comments' => true],
        ['name' => 'Радиоуправление на практике', 'about' => 'Сборка, настройка, ремонт.', 'subs' => 4, 'posts' => 2, 'comments' => false],
        ['name' => 'Космическая техника', 'about' => 'Ракеты, станции, скафандры.', 'subs' => 3, 'posts' => 2, 'comments' => true],
    ];

    public function __construct(
        private readonly ChannelApplicationService $applications,
        private readonly ChannelPostService $channelPosts,
        private readonly CommentService $comments,
        private readonly MediaUploadService $uploads,
    ) {}

    public function key(): string
    {
        return 'channels';
    }

    public function title(): string
    {
        return 'Каналы';
    }

    public function columns(): array
    {
        return ['канал', 'подписчиков', 'записей', 'комментарии', 'есть'];
    }

    public function plan(): array
    {
        $have = $this->existingNames();
        $rows = [];
        $create = 0;
        $exists = 0;

        foreach (self::ITEMS as $item) {
            $already = isset($have[$item['name']]);
            $rows[] = [$item['name'], $item['subs'], $item['posts'], $item['comments'] ? 'включены' : 'выключены', $already ? 'да' : '—'];
            $already ? $exists++ : $create++;
        }

        return ['rows' => $rows, 'create' => $create, 'exists' => $exists];
    }

    public function create(callable $tick): int
    {
        $have = $this->existingNames();
        $people = array_values($this->people());
        $admin = User::query()->where('role', UserRole::Admin)->orderBy('id')->first();
        if (count($people) < 3 || $admin === null) {
            return 0;
        }

        $made = 0;
        foreach (self::ITEMS as $index => $item) {
            if (isset($have[$item['name']])) {
                continue;
            }

            $owner = $people[($index * 2 + 1) % count($people)];
            $avatar = $this->image($owner, $this->uploads, $item['name'], 'avatar');
            $banner = $this->image($owner, $this->uploads, $item['name'].' — обложка', 'cover');

            $application = $this->applications->apply(
                $owner,
                $item['name'],
                self::MARKER.' '.$item['about'],
                null,
                $avatar->id,
                $banner->id,
                null,
                null,
                $item['comments'],
            );
            $channel = $this->applications->approve($application, $admin);

            $this->subscribe($channel, $people, $item['subs'], $index);
            $this->publish($channel, $owner, $people, $item, $index);

            $made++;
            $tick($item['name']);
        }

        return $made;
    }

    /** @param list<User> $people */
    private function subscribe(Channel $channel, array $people, int $target, int $index): void
    {
        $count = 0;
        foreach ($people as $offset => $_) {
            if ($count >= $target) {
                break;
            }
            $person = $people[($index * 7 + $offset + 2) % count($people)];
            if ($person->id === $channel->owner_id || $channel->subscribers()->where('users.id', $person->id)->exists()) {
                continue;
            }
            // В сводной таблице только `channel_id`/`user_id` и отметки времени:
            // дополнительного `subscribed_at` там нет.
            $channel->subscribers()->attach($person->id);
            $count++;
        }

        $channel->forceFill(['subscribers_count' => $channel->subscribers()->count()])->save();
    }

    /**
     * @param  list<User>  $people
     * @param  array{name: string, about: string, subs: int, posts: int, comments: bool}  $item
     */
    private function publish(Channel $channel, User $owner, array $people, array $item, int $index): void
    {
        for ($i = 0; $i < $item['posts']; $i++) {
            $title = self::MARKER.' '.$item['name'].' — выпуск '.($i + 1);
            $media = $i % 2 === 0 ? [$this->image($owner, $this->uploads, $title, 'post')->uuid] : [];

            /*
             * У записи канала одно текстовое поле — `text`, заголовка нет.
             * Зеркало в ленте сервис делает сам, из него же берётся заголовок.
             */
            $channelPost = $this->channelPosts->create($channel, $owner, [
                'text' => $title."\n\n".($i % 2 === 0 ? DemoTexts::medium($title) : DemoTexts::short($title)),
            ], $media);
            if ($channelPost->status !== 'published') {
                $this->channelPosts->publish($channelPost);
            }

            // Запись канала зеркалится в ленту полем `feed_post_id`; комментарии
            // живут на зеркале, а не на самой записи канала.
            if ($item['comments'] && $channelPost->feed_post_id) {
                $post = \App\Models\Post::query()->find($channelPost->feed_post_id);
                if ($post) {
                    $lines = DemoTexts::comments();
                    for ($k = 0; $k <= $index % 3; $k++) {
                        $user = $people[($index * 3 + $k + $i) % count($people)];
                        $this->comments->createOnPost($post, $user, $lines[($index + $k) % count($lines)]);
                    }
                }
            }
        }
    }

    /** @return array<string, true> */
    private function existingNames(): array
    {
        return Channel::query()
            ->whereIn('name', array_column(self::ITEMS, 'name'))
            ->pluck('name')
            ->mapWithKeys(fn ($n): array => [(string) $n => true])
            ->all();
    }
}
