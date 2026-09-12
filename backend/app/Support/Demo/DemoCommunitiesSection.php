<?php

namespace App\Support\Demo;

use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\CommunityEvent;
use App\Models\User;
use Modules\Community\Services\CommunityService;
use Modules\Feed\Services\PostService;
use Modules\Media\Services\MediaUploadService;

/**
 * Сообщества: обложка, аватар, описание, участники, стена, мероприятия.
 *
 * РАЗМЕР ОГРАНИЧЕН СОСТАВОМ. В задании «от двух участников до полусотни», но
 * демо-людей тридцать шесть, и набирать сообщество из живых участников нельзя.
 * Поэтому верх — тридцать четыре человека (все демо-люди минус владелец и
 * запас), а не пятьдесят. Это ограничение состава, а не недоделка: чтобы
 * получить полсотни, надо расширять состав людей, а он задан в тридцать–сорок.
 *
 * ЧЕРЕЗ ЗАЯВКУ И ОДОБРЕНИЕ. Сообщество создаётся тем же путём, что у живого
 * человека: `apply` от будущего владельца, `approveApplication` от админа.
 * Прямая вставка в `communities` дала бы сообщество без владельца в
 * `community_members` и без чата — на таком проверять нечего.
 *
 * ОДНА ЗАЯВКА НА ЧЕЛОВЕКА. Сервис не даёт подать вторую, пока первая висит,
 * поэтому владельцы разные и заявка одобряется сразу после подачи.
 */
class DemoCommunitiesSection extends DemoSection
{
    /** @var list<array{name: string, about: string, members: int, posts: int, events: int}> */
    private const ITEMS = [
        ['name' => 'Авиация 1:48 — сборка и покраска', 'about' => 'Обсуждаем наборы, краски и расшивку. Показываем этапы.', 'members' => 34, 'posts' => 6, 'events' => 2],
        ['name' => 'Бронетехника: траки и грязь', 'about' => 'Всё про гусеницы, пигменты и честную грязь на модели.', 'members' => 28, 'posts' => 5, 'events' => 1],
        ['name' => 'Флот и парусники', 'about' => 'Такелаж, дерево, пластик. Медленно, но верно.', 'members' => 22, 'posts' => 4, 'events' => 1],
        ['name' => 'Железная дорога H0', 'about' => 'Модули, ландшафт, подвижной состав.', 'members' => 18, 'posts' => 4, 'events' => 0],
        ['name' => 'Автомодели и ралли', 'about' => 'Семидесятые, восьмидесятые и вечный спор про нитру.', 'members' => 15, 'posts' => 3, 'events' => 1],
        ['name' => 'Миниатюры и фигурки', 'about' => 'Лица, ткани, оттенки кожи. Масло против акрила.', 'members' => 12, 'posts' => 3, 'events' => 0],
        ['name' => 'Диорамы: свет и фактура', 'about' => 'Как собрать сцену, а не поставить модель на доску.', 'members' => 9, 'posts' => 3, 'events' => 1],
        ['name' => 'Космос и ракеты', 'about' => 'От «Востока» до «Сатурна». Масштабы и чертежи.', 'members' => 7, 'posts' => 2, 'events' => 0],
        ['name' => 'Радиоуправляемые модели', 'about' => 'Ходовые модели, аккумуляторы, площадки для запуска.', 'members' => 5, 'posts' => 2, 'events' => 1],
        ['name' => 'Начинающим: первый набор', 'about' => 'Вопросы без стеснения. Отвечаем по делу.', 'members' => 4, 'posts' => 2, 'events' => 0],
        ['name' => 'Инструмент и мастерская', 'about' => 'Аэрографы, компрессоры, вытяжка, свет.', 'members' => 3, 'posts' => 2, 'events' => 0],
        ['name' => 'Обмен и поиск наборов', 'about' => 'Ищу-меняю. Без продаж — для них есть объявления.', 'members' => 2, 'posts' => 1, 'events' => 0],
    ];

    public function __construct(
        private readonly CommunityService $communities,
        private readonly PostService $posts,
        private readonly MediaUploadService $uploads,
    ) {}

    public function key(): string
    {
        return 'communities';
    }

    public function title(): string
    {
        return 'Сообщества';
    }

    public function columns(): array
    {
        return ['сообщество', 'участников', 'записей', 'мероприятий', 'есть'];
    }

    public function plan(): array
    {
        $have = $this->existingNames();
        $rows = [];
        $create = 0;
        $exists = 0;

        foreach (self::ITEMS as $item) {
            $already = isset($have[$item['name']]);
            $rows[] = [$item['name'], $item['members'], $item['posts'], $item['events'], $already ? 'да' : '—'];
            $already ? $exists++ : $create++;
        }

        return ['rows' => $rows, 'create' => $create, 'exists' => $exists];
    }

    public function create(callable $tick): int
    {
        $have = $this->existingNames();
        $people = array_values($this->people());
        if (count($people) < 3) {
            return 0;
        }

        $admin = User::query()->where('role', \App\Enums\UserRole::Admin)->orderBy('id')->first();
        if ($admin === null) {
            return 0;
        }

        $categoryIds = CommunityCategory::query()->orderBy('id')->pluck('id')->all();
        $made = 0;

        foreach (self::ITEMS as $index => $item) {
            if (isset($have[$item['name']])) {
                continue;
            }

            $owner = $people[$index % count($people)];
            $application = $this->communities->apply(
                $owner,
                $item['name'],
                self::MARKER.' '.$item['about'],
                $categoryIds === [] ? 0 : (int) $categoryIds[$index % count($categoryIds)],
            );
            $community = $this->communities->approveApplication($application, $admin);

            $this->dressUp($community, $owner, $item['name']);
            $this->fill($community, $owner, $people, $item, $index);

            $made++;
            $tick($item['name']);
        }

        return $made;
    }

    private function dressUp(Community $community, User $owner, string $name): void
    {
        $avatar = $this->image($owner, $this->uploads, $name, 'avatar');
        $cover = $this->image($owner, $this->uploads, $name.' — обложка', 'cover');

        $community->forceFill([
            'avatar_media_id' => $avatar->id,
            'cover_media_id' => $cover->id,
        ])->save();
    }

    /**
     * @param  list<User>  $people
     * @param  array{name: string, about: string, members: int, posts: int, events: int}  $item
     */
    private function fill(Community $community, User $owner, array $people, array $item, int $index): void
    {
        $joined = 1; // владелец уже внутри
        foreach ($people as $offset => $person) {
            if ($joined >= $item['members']) {
                break;
            }
            $candidate = $people[($index * 5 + $offset + 1) % count($people)];
            if ($candidate->id === $owner->id || $community->members()->where('users.id', $candidate->id)->exists()) {
                continue;
            }
            $this->communities->join($candidate, $community);
            $joined++;
        }

        /*
         * Автор записи на стене обязан состоять в сообществе — сервис это
         * проверяет и иначе отвечает «Нужно состоять в сообществе, чтобы
         * публиковать там». Поэтому авторы берутся из числа вступивших, а не
         * из всего состава.
         */
        $members = $community->members()->pluck('users.id')->all();
        $byId = [];
        foreach ($people as $person) {
            $byId[$person->id] = $person;
        }
        $authors = array_values(array_filter(array_map(fn ($id) => $byId[$id] ?? null, $members)));
        if ($authors === []) {
            $authors = [$owner];
        }

        for ($i = 0; $i < $item['posts']; $i++) {
            $author = $authors[($index * 3 + $i) % count($authors)];
            $title = self::MARKER.' '.$item['name'].' — запись '.($i + 1);
            $post = $this->posts->create($author, [
                'community_id' => $community->id,
                'title' => $title,
                'body' => $i % 2 === 0 ? DemoTexts::medium($title) : DemoTexts::short($title),
            ]);
            $this->posts->markPublished($post);
            $post->forceFill(['published_at' => now()->subDays(($index + $i) % 20)])->save();
        }

        for ($i = 0; $i < $item['events']; $i++) {
            CommunityEvent::create([
                'community_id' => $community->id,
                'created_by' => $owner->id,
                'title' => self::MARKER.' Встреча клуба — '.$item['name'],
                'description' => 'Показываем работы, обсуждаем сборку. Вход свободный.',
                'starts_at' => now()->addDays(7 + $index + $i * 14),
                'location_name' => 'Клубная площадка, зал '.(($index % 3) + 1),
            ]);
        }
    }

    /** @return array<string, true> */
    private function existingNames(): array
    {
        return Community::query()
            ->whereIn('name', array_column(self::ITEMS, 'name'))
            ->pluck('name')
            ->mapWithKeys(fn ($n): array => [(string) $n => true])
            ->all();
    }
}
