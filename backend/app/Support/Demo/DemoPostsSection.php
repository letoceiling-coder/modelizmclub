<?php

namespace App\Support\Demo;

use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Feed\Services\CommentService;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;
use Modules\Media\Services\MediaUploadService;

/**
 * Записи ленты: состав медиа, длины текста, время публикации, отклик.
 *
 * СКОЛЬКО И ПОЧЕМУ ИМЕННО СТОЛЬКО. В задании два условия, которые вместе не
 * сходятся: «60–80 записей» и «по 5–8 записей на каждый вариант» от одной до
 * десяти фотографий. Даже по нижней границе это 50 записей только на фото,
 * плюс текстовые, плюс видео — верхняя граница в 80 лопается. Взял нижнюю
 * границу второго условия: по пять записей на каждый из десяти вариантов
 * (50), пятнадцать без медиа и пять с видео. Итого 70 — внутри 60–80.
 *
 * ДЛИНЫ ТЕКСТА выбраны по замеренным порогам карточки: сворачивание включается
 * на 150 символах на телефоне и на 330 на широком экране
 * (`PostCard.tsx:379-384`). Короткий текст (43) не сворачивается нигде,
 * средний (270) — только на телефоне, длинный (921) — везде. То есть все три
 * состояния кнопки «Показать ещё» на наборе видны.
 *
 * ВРЕМЯ. Публикации размазаны на месяц назад. `markPublished` ставит
 * `published_at` на сейчас, поэтому дату приходится проставлять отдельным
 * обновлением — иначе весь набор падает одной секундой и лента не проверяет
 * ни группировку по дням, ни порядок.
 *
 * ОТКЛИК НЕРАВНОМЕРНЫЙ. Счётчики под записью — отдельный источник ошибок
 * (пересчёт уже однажды обнулил их на проде). Ровные значения такую ошибку
 * прячут, поэтому реакции, комментарии и репосты распределены по посеву от
 * заголовка: часть записей остаётся вовсе без отклика.
 */
class DemoPostsSection extends DemoSection
{
    /** Сколько записей на каждый вариант количества фотографий. */
    private const PER_PHOTO_VARIANT = 5;

    private const TEXT_ONLY = 15;

    private const WITH_VIDEO = 5;

    public function __construct(
        private readonly PostService $posts,
        private readonly CommentService $comments,
        private readonly PostInteractionService $interactions,
        private readonly MediaUploadService $uploads,
    ) {}

    public function key(): string
    {
        return 'posts';
    }

    public function title(): string
    {
        return 'Записи ленты';
    }

    public function columns(): array
    {
        return ['состав', 'записей', 'фотографий', 'уже есть'];
    }

    public function warnings(): array
    {
        return DemoVideoFactory::available()
            ? []
            : ['нет ffmpeg — записи с видео будут созданы без видео'];
    }

    public function plan(): array
    {
        $have = $this->existingTitles();
        $rows = [];
        $create = 0;
        $exists = 0;
        $photos = 0;

        foreach ($this->groups() as $label => $specs) {
            $missing = array_values(array_filter($specs, fn (array $s): bool => ! isset($have[$s['title']])));
            $groupPhotos = array_sum(array_map(fn (array $s): int => $s['photos'], $missing));
            $rows[] = [$label, count($specs), array_sum(array_map(fn (array $s): int => $s['photos'], $specs)), count($specs) - count($missing)];
            $create += count($missing);
            $exists += count($specs) - count($missing);
            $photos += $groupPhotos;
        }

        return ['rows' => $rows, 'create' => $create, 'exists' => $exists, 'photos' => $photos];
    }

    public function create(callable $tick): int
    {
        $have = $this->existingTitles();
        $people = array_values($this->people());
        if ($people === []) {
            return 0;
        }

        $made = 0;
        foreach ($this->specs() as $spec) {
            if (isset($have[$spec['title']])) {
                continue;
            }

            $author = $people[$spec['author'] % count($people)];
            $post = $this->makePost($author, $spec);
            $this->engage($post, $spec, $people);

            $made++;
            $tick($spec['title']);
        }

        return $made;
    }

    /** @param array<string, mixed> $spec */
    private function makePost(User $author, array $spec): Post
    {
        $mediaIds = [];
        for ($i = 1; $i <= $spec['photos']; $i++) {
            $mediaIds[] = $this->image($author, $this->uploads, $spec['title'].' · '.$i, 'post')->uuid;
        }
        if ($spec['video']) {
            $video = DemoVideoFactory::upload($author, $this->uploads, $spec['title']);
            if ($video !== null) {
                $mediaIds[] = $video->uuid;
            }
        }

        $post = $this->posts->create($author, [
            'category_id' => $spec['category_id'],
            'title' => $spec['title'],
            'body' => $spec['body'],
            'media_ids' => $mediaIds,
        ]);
        $this->posts->markPublished($post);

        // Дата — отдельным обновлением: `markPublished` знает только «сейчас».
        $post->forceFill(['published_at' => now()->subDays($spec['days_ago'])->subHours($spec['hour'])])->save();

        return $post->fresh() ?? $post;
    }

    /**
     * Отклик: реакции, комментарии, ответы второго уровня, репосты.
     *
     * @param  array<string, mixed>  $spec
     * @param  list<User>  $people
     */
    private function engage(Post $post, array $spec, array $people): void
    {
        $comments = DemoTexts::comments();
        $replies = DemoTexts::replies();

        for ($i = 0; $i < $spec['reactions']; $i++) {
            $user = $people[($spec['author'] + $i * 3 + 1) % count($people)];
            if ($user->id === $post->user_id) {
                continue;
            }
            $this->interactions->react($post, $user, 'like');
        }

        $parents = [];
        for ($i = 0; $i < $spec['comments']; $i++) {
            $user = $people[($spec['author'] + $i * 5 + 2) % count($people)];
            $parents[] = $this->comments->createOnPost($post, $user, $comments[($spec['seed'] + $i) % count($comments)]);
        }

        for ($i = 0; $i < $spec['replies'] && isset($parents[$i]); $i++) {
            $author = $people[$spec['author'] % count($people)];
            $this->comments->createOnPost($post, $author, $replies[($spec['seed'] + $i) % count($replies)], $parents[$i]->uuid);
        }

        for ($i = 0; $i < $spec['reposts']; $i++) {
            $user = $people[($spec['author'] + $i * 7 + 3) % count($people)];
            if ($user->id === $post->user_id) {
                continue;
            }
            $this->interactions->repost($post, $user, null);
        }
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function groups(): array
    {
        $groups = ['фотографии 1–5' => [], 'фотографии 6–10' => [], 'только текст' => [], 'с видео' => []];
        foreach ($this->specs() as $spec) {
            if ($spec['video']) {
                $groups['с видео'][] = $spec;
            } elseif ($spec['photos'] === 0) {
                $groups['только текст'][] = $spec;
            } elseif ($spec['photos'] <= 5) {
                $groups['фотографии 1–5'][] = $spec;
            } else {
                $groups['фотографии 6–10'][] = $spec;
            }
        }

        return $groups;
    }

    /**
     * Полный список записей набора.
     *
     * @return list<array<string, mixed>>
     */
    /** @var list<array<string, mixed>>|null */
    private ?array $specsCache = null;

    private function specs(): array
    {
        /*
         * Кеш — на экземпляр, не статический. Со статическим список переживал
         * смену базы (в тестах между случаями, в долгом процессе — между
         * прогонами) и держал идентификаторы узлов, которых уже нет: запись
         * падала с «Категория не найдена».
         */
        if ($this->specsCache !== null) {
            return $this->specsCache;
        }

        $nodes = PostCategory::query()->where('is_active', true)->orderBy('id')->get(['id', 'name']);
        if ($nodes->isEmpty()) {
            return $this->specsCache = [];
        }

        $specs = [];
        $n = 0;

        $add = function (int $photos, bool $video) use (&$specs, &$n, $nodes): void {
            $node = $nodes[$n % $nodes->count()];
            $titles = DemoTexts::titles($node->name);
            $title = self::MARKER.' '.$titles[$n % count($titles)].' #'.($n + 1);
            $seed = abs(crc32($title));
            $length = $n % 3;

            $specs[] = [
                'title' => $title,
                'body' => match ($length) {
                    0 => DemoTexts::short($title),
                    1 => DemoTexts::medium($title),
                    default => DemoTexts::long($title),
                },
                'category_id' => (int) $node->id,
                'photos' => $photos,
                'video' => $video,
                'author' => $n,
                'seed' => $seed,
                'days_ago' => $seed % 31,
                'hour' => $seed % 24,
                // Неравномерно и с нулями: часть записей остаётся без отклика.
                'reactions' => $seed % 7 === 0 ? 0 : $seed % 26,
                'comments' => $seed % 5 === 0 ? 0 : $seed % 9,
                'replies' => $seed % 4,
                'reposts' => $seed % 11 === 0 ? $seed % 4 : 0,
            ];
            $n++;
        };

        for ($photos = 1; $photos <= 10; $photos++) {
            for ($k = 0; $k < self::PER_PHOTO_VARIANT; $k++) {
                $add($photos, false);
            }
        }
        for ($k = 0; $k < self::TEXT_ONLY; $k++) {
            $add(0, false);
        }
        for ($k = 0; $k < self::WITH_VIDEO; $k++) {
            $add(0, true);
        }

        return $this->specsCache = $specs;
    }

    /** @return array<string, true> */
    private function existingTitles(): array
    {
        $ids = User::query()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('id')->all();
        if ($ids === []) {
            return [];
        }

        return DB::table('posts')
            ->whereIn('user_id', $ids)
            ->whereNull('deleted_at')
            ->pluck('title')
            ->mapWithKeys(fn ($t): array => [(string) $t => true])
            ->all();
    }
}
