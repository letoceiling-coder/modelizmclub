<?php

namespace App\Console\Commands;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\City;
use App\Models\Comment;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\FriendRequest;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Message;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Chat\Services\ChatService;
use Modules\Community\Services\CommunityService;
use Modules\Feed\Services\CommentService;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;
use Modules\Listing\Services\ListingService;
use Modules\User\Services\FriendService;
use Modules\User\Services\UserService;

/**
 * End-to-end activity simulation for production smoke testing.
 *
 * Creates N realistic users and drives the full social cycle through the
 * real service layer (the same code the API controllers call): profiles,
 * interests, posts + publish, listings, views, reactions, bookmarks,
 * comments + replies, reposts, follows, friend requests, community joins
 * and direct chat. Every action is wrapped so the command doubles as a
 * functional test harness and prints an outcome report at the end.
 *
 * Simulated accounts are tagged by the @sim.modelizmclub.ru email domain
 * so they can be cleanly wiped with --fresh.
 */
class SimulateActivityCommand extends Command
{
    protected $signature = 'app:simulate-activity
        {--users=10 : Number of users to simulate}
        {--fresh : Delete previously simulated accounts and their content before running}
        {--password=password : Password assigned to every simulated user}';

    protected $description = 'Simulate a full multi-user activity cycle on real data and print a report';

    private const EMAIL_DOMAIN = 'sim.modelizmclub.ru';

    /** @var array<string, array{ok:int, fail:int, errors:array<int,string>}> */
    private array $results = [];

    private const PERSONAS = [
        ['Анна Котова', 'Собираю самолёты 1/48, люблю авиацию Второй мировой.'],
        ['Дмитрий Орлов', 'Бронетехника и диорамы. Airbrush головного мозга.'],
        ['Мария Соколова', 'Парусники и корабли. Такелаж — это медитация.'],
        ['Иван Петров', 'Sci-fi и Gundam. Кит-бэшинг и кастомы.'],
        ['Екатерина Волкова', 'Фигурки и историческая миниатюра, масштаб 54мм.'],
        ['Сергей Морозов', 'Автомобили 1/24, реставрирую классику в пластике.'],
        ['Ольга Новикова', 'Жидкие маски, везеринг, пигменты. Делюсь техникой.'],
        ['Алексей Зайцев', 'Танки СССР, интерьеры и полная расшивка.'],
        ['Наталья Лебедева', 'Авиация гражданская, лайнеры 1/144.'],
        ['Павел Соловьёв', 'Космос и ракеты, скретчбилд из подручного.'],
    ];

    private const POST_TEMPLATES = [
        ['Закончил сборку %s', 'Наконец-то довёл до финиша %s. Делал около двух недель по вечерам, больше всего времени ушло на расшивку и везеринг. Доволен результатом, но капот переделал бы. Что думаете?'],
        ['Работа в процессе: %s', 'WIP по %s. Сейчас на этапе предварительной окраски, задул грунт и базовый цвет. Дальше — маскировка и камуфляж. Покажу следующий шаг через пару дней.'],
        ['Вопрос по покраске %s', 'Подскажите по %s: чем лучше делать смывку по глянцу — масло или эмаль? И какой лак брать под декали, чтобы не было серебрения?'],
        ['Обзор набора %s', 'Купил %s, открыл коробку — литники чистые, облоя почти нет, расшивка внутренняя. Декаль тонкая. По цене считаю отличный вариант для начинающих.'],
        ['Диорама с %s', 'Собрал небольшую сцену вокруг %s: основание из пенокартона, трава из флока, немного грязи пигментами. Хотел передать осеннюю распутицу.'],
    ];

    private const SUBJECTS = [
        'Bf 109 от Eduard', 'Т-34-85 от Звезды', 'фрегат «Поларис»', 'RX-78-2 Gundam',
        'P-51D Mustang', 'Tiger I от Tamiya', 'ИС-2 1/35', 'Spitfire Mk.IX',
        'Boeing 737 1/144', 'ракеты «Восток»', 'Porsche 911 1/24', 'фигурка рыцаря 54мм',
    ];

    private const LISTING_TEMPLATES = [
        ['Продам набор %s', 'Продаю запечатанный набор %s. Не собирался, литники в заводской упаковке, декаль целая. Отправка по России, возможен самовывоз.'],
        ['Краски и расходники для %s', 'Отдам набор акрила и масок, оставшихся после проекта %s. Почти полные баночки, маски не использованы.'],
        ['Обмен: %s', 'Готов обменять %s на что-то из авиации 1/48. Состояние отличное, всё на месте. Пишите предложения.'],
    ];

    private const COMMENTS = [
        'Отличная работа, расшивка читается аккуратно!',
        'Подскажи, каким лаком задувал перед декалями?',
        'Камуфляж супер, маски или от руки?',
        'Тоже такой собираю, литьё там и правда хорошее.',
        'По смывке — попробуй масло, под глянцем ложится мягче.',
        'Жду продолжения, очень атмосферно получается.',
        'Где брал основание под диораму?',
        'Цвет металла шикарный, чем делал?',
    ];

    private const REPLIES = [
        'Спасибо! Лак брал акриловый глянцевый, в два слоя.',
        'От руки аэром, давление сбрасывал до минимума.',
        'Масло уже заказал, попробую на следующем этапе.',
        'Основание из пенокартона, обтянул шпатлёвкой.',
    ];

    private const CHAT_LINES = [
        'Привет! Видел твою последнюю работу — огонь.',
        'Спасибо! Долго возился с камуфляжем.',
        'Каким аэром пользуешься?',
        'H&S Evolution, двойного действия.',
        'Не подскажешь магазин с нормальными декалями?',
        'Скину ссылку вечером, там же маски беру.',
        'Договорились, спасибо большое!',
    ];

    public function handle(
        UserService $users,
        FriendService $friends,
        PostService $posts,
        PostInteractionService $interactions,
        CommentService $comments,
        ListingService $listings,
        ChatService $chat,
        CommunityService $communities,
    ): int {
        $count = max(1, (int) $this->option('users'));
        $password = (string) $this->option('password');

        if ($this->option('fresh')) {
            $this->cleanup();
        }

        $this->info('Подготовка справочных данных…');
        $postCategories = PostCategory::query()->where('is_active', true)->pluck('id')->all();
        $listingCategories = ListingCategory::query()->where('is_active', true)->pluck('id')->all();
        $cityId = City::query()->value('id');
        $community = Community::query()->where('status', 'active')->orderByDesc('members_count')->first();

        if ($postCategories === []) {
            $this->error('Нет активных категорий постов — нечего публиковать. Запустите сидеры.');

            return self::FAILURE;
        }

        // ---- Phase 1: users ----------------------------------------------
        $this->info("Создание {$count} пользователей…");
        /** @var array<int, User> $created */
        $created = [];
        for ($i = 1; $i <= $count; $i++) {
            $persona = self::PERSONAS[($i - 1) % count(self::PERSONAS)];
            $name = $i <= count(self::PERSONAS) ? $persona[0] : $persona[0].' '.$i;
            $bio = $persona[1];
            $email = 'sim'.$i.'@'.self::EMAIL_DOMAIN;

            $user = $this->step('user.create', fn () => $this->makeUser($email, $name, $password));
            if (! $user) {
                continue;
            }
            $created[] = $user;

            $this->step('profile.update', fn () => $users->updateProfile($user, array_filter([
                'bio' => $bio,
                'city_id' => $cityId,
            ], fn ($v) => $v !== null)));

            $interestIds = collect($postCategories)->shuffle()->take(min(3, count($postCategories)))->values()->all();
            $this->step('interests.sync', fn () => $users->syncInterests($user, $interestIds));
        }

        if ($created === []) {
            $this->error('Не удалось создать ни одного пользователя.');
            $this->renderReport($community);

            return self::FAILURE;
        }

        // ---- Phase 2: posts + publish ------------------------------------
        $this->info('Публикация постов…');
        /** @var array<int, Post> $publishedPosts */
        $publishedPosts = [];
        foreach ($created as $idx => $author) {
            for ($p = 0; $p < 2; $p++) {
                $tpl = self::POST_TEMPLATES[($idx + $p) % count(self::POST_TEMPLATES)];
                $subject = self::SUBJECTS[($idx * 2 + $p) % count(self::SUBJECTS)];

                $post = $this->step('post.create', fn () => $posts->create($author, [
                    'category_id' => $postCategories[array_rand($postCategories)],
                    'title' => sprintf($tpl[0], $subject),
                    'body' => sprintf($tpl[1], $subject),
                    'hashtags' => ['моделизм', Str::slug($subject, '')],
                ]));

                if (! $post) {
                    continue;
                }

                $published = $this->step('post.publish', fn () => $posts->publish($post, $author));
                if ($published && $published->status->value === 'published') {
                    $publishedPosts[] = $published;
                }
            }
        }

        // ---- Phase 3: cross interactions (views, reactions, comments) ----
        $this->info('Просмотры, реакции, комментарии…');
        foreach ($publishedPosts as $post) {
            $author = $post->user_id;
            $viewers = collect($created)->reject(fn (User $u) => $u->id === $author)->shuffle()->take(5);

            foreach ($viewers as $vi => $viewer) {
                $this->step('post.view', fn () => $posts->recordView($post, $viewer));
                $this->step('post.react', fn () => $interactions->react($post, $viewer, 'like'));

                if ($vi % 2 === 0) {
                    $this->step('post.bookmark', fn () => $interactions->bookmark($post, $viewer));
                }

                $body = self::COMMENTS[array_rand(self::COMMENTS)];
                $comment = $this->step('comment.create', fn () => $comments->createOnPost($post, $viewer, $body));

                // The post author replies to one of the comments.
                if ($comment && $vi === 0) {
                    $authorUser = collect($created)->firstWhere('id', $author);
                    if ($authorUser) {
                        $this->step('comment.reply', fn () => $comments->createOnPost(
                            $post,
                            $authorUser,
                            self::REPLIES[array_rand(self::REPLIES)],
                            $comment->uuid,
                        ));
                    }
                }
            }

            // One viewer reposts.
            $reposter = collect($created)->reject(fn (User $u) => $u->id === $author)->random();
            $this->step('post.repost', fn () => $interactions->repost($post, $reposter));
        }

        // ---- Phase 4: listings + views -----------------------------------
        if ($listingCategories !== []) {
            $this->info('Публикация объявлений…');
            /** @var array<int, Listing> $createdListings */
            $createdListings = [];
            foreach ($created as $idx => $owner) {
                $tpl = self::LISTING_TEMPLATES[$idx % count(self::LISTING_TEMPLATES)];
                $subject = self::SUBJECTS[$idx % count(self::SUBJECTS)];

                $listing = $this->step('listing.create', fn () => $listings->create($owner, [
                    'category_id' => $listingCategories[array_rand($listingCategories)],
                    'title' => sprintf($tpl[0], $subject),
                    'description' => sprintf($tpl[1], $subject),
                    'price_cents' => random_int(50, 800) * 100,
                    'city_id' => $cityId,
                    'publish' => true,
                ]));

                if ($listing) {
                    $createdListings[] = $listing;
                }
            }

            foreach ($createdListings as $listing) {
                $viewers = collect($created)->reject(fn (User $u) => $u->id === $listing->user_id)->shuffle()->take(4);
                foreach ($viewers as $viewer) {
                    $this->step('listing.view', fn () => $listings->recordView($listing, $viewer));
                }
            }
        } else {
            $this->warn('Нет активных категорий объявлений — раздел объявлений пропущен.');
        }

        // ---- Phase 5: social graph (follows + friends) -------------------
        $this->info('Подписки и заявки в друзья…');
        $n = count($created);
        foreach ($created as $i => $actor) {
            // Follow next two users in the ring.
            foreach ([1, 2] as $offset) {
                $target = $created[($i + $offset) % $n];
                if ($target->id !== $actor->id) {
                    $this->step('user.follow', fn () => $users->follow($actor, $target));
                }
            }

            // Friend request to the next user; that user accepts.
            $friend = $created[($i + 1) % $n];
            if ($friend->id !== $actor->id) {
                $request = $this->step('friend.request', fn () => $friends->sendRequest($actor, $friend));
                if ($request instanceof FriendRequest && $request->status->value === 'pending') {
                    $this->step('friend.accept', fn () => $friends->acceptRequest($friend, $request));
                }
            }
        }

        // ---- Phase 6: community ------------------------------------------
        if ($community) {
            $this->info("Вступление в сообщество «{$community->name}»…");
            foreach ($created as $member) {
                $this->step('community.join', fn () => $communities->join($member, $community));
            }

            $poster = $created[0];
            $this->step('community.post', fn () => $posts->publish(
                $posts->create($poster, [
                    'category_id' => $postCategories[array_rand($postCategories)],
                    'community_id' => $community->id,
                    'title' => 'Привет, '.$community->name.'!',
                    'body' => 'Только что вступил в сообщество. Покажу здесь свои текущие проекты, рад знакомству!',
                ]),
                $poster,
            ));
        } else {
            $this->warn('Нет активных сообществ — раздел сообществ пропущен.');
        }

        // ---- Phase 7: direct chat ----------------------------------------
        $this->info('Личные переписки…');
        foreach ($created as $i => $sender) {
            $recipient = $created[($i + 1) % $n];
            if ($recipient->id === $sender->id) {
                continue;
            }

            $conversation = $this->step('chat.open', fn () => $chat->findOrCreateDirect($sender, $recipient));
            if (! $conversation instanceof Conversation) {
                continue;
            }

            foreach (self::CHAT_LINES as $line => $text) {
                $speaker = $line % 2 === 0 ? $sender : $recipient;
                $this->step('chat.message', fn () => $chat->sendMessage($conversation, $speaker, $text));
            }
        }

        $this->newLine();
        $this->renderResults();
        $this->renderReport($community);
        $this->renderCredentials($created, $password);

        return self::SUCCESS;
    }

    private function makeUser(string $email, string $name, string $password): User
    {
        /** @var User|null $existing */
        $existing = User::withTrashed()->where('email', $email)->first();
        if ($existing) {
            if (! $existing->profile) {
                $this->createProfile($existing);
            }

            return $existing;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'registration_track' => random_int(0, 1) === 0 ? RegistrationTrack::Community : RegistrationTrack::Listing,
            'email_verified_at' => now(),
        ]);

        $this->createProfile($user);

        if (method_exists($user, 'assignRole') && ! $user->hasRole('user')) {
            try {
                $user->assignRole('user');
            } catch (\Throwable) {
                // Spatie role may be absent in a stripped environment.
            }
        }

        return $user;
    }

    private function createProfile(User $user): void
    {
        $base = $user->name ?: Str::before($user->email, '@');
        $slug = Str::slug($base) ?: 'user';
        $original = $slug;
        $suffix = 1;
        while (UserProfile::where('slug', $slug)->exists()) {
            $slug = $original.'-'.$suffix++;
        }

        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $base,
            'slug' => $slug,
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        $user->load('profile');
    }

    /**
     * @param  callable():mixed  $fn
     */
    private function step(string $action, callable $fn): mixed
    {
        $this->results[$action] ??= ['ok' => 0, 'fail' => 0, 'errors' => []];

        try {
            $value = $fn();
            $this->results[$action]['ok']++;

            return $value;
        } catch (\Throwable $e) {
            $this->results[$action]['fail']++;
            if (count($this->results[$action]['errors']) < 3) {
                $this->results[$action]['errors'][] = $e->getMessage();
            }

            return null;
        }
    }

    private function renderResults(): void
    {
        $this->info('=== Результаты действий (через сервисный слой) ===');
        $rows = [];
        ksort($this->results);
        foreach ($this->results as $action => $r) {
            $rows[] = [
                $action,
                $r['ok'],
                $r['fail'],
                $r['fail'] > 0 ? Str::limit($r['errors'][0] ?? '', 60) : '—',
            ];
        }
        $this->table(['Действие', 'OK', 'Ошибки', 'Первая ошибка'], $rows);
    }

    private function renderReport(?Community $community): void
    {
        $ids = $this->simUserIds();
        if ($ids === []) {
            return;
        }

        $postIds = Post::query()->whereIn('user_id', $ids)->pluck('id');

        $stats = [
            ['Пользователи (sim)', User::query()->whereIn('id', $ids)->count()],
            ['Посты опубликованы', Post::query()->whereIn('user_id', $ids)->where('status', 'published')->whereNull('repost_of_id')->count()],
            ['Репосты', Post::query()->whereIn('user_id', $ids)->whereNotNull('repost_of_id')->count()],
            ['Сумма просмотров постов', (int) Post::query()->whereIn('user_id', $ids)->sum('views_count')],
            ['Сумма реакций постов', (int) Post::query()->whereIn('user_id', $ids)->sum('reactions_count')],
            ['Комментарии', Comment::query()->whereIn('commentable_id', $postIds)->where('commentable_type', Post::class)->count()],
            ['Объявления', Listing::query()->whereIn('user_id', $ids)->count()],
            ['Сумма просмотров объявлений', (int) Listing::query()->whereIn('user_id', $ids)->sum('views_count')],
            ['Подписки (follows)', DB::table('user_follows')->whereIn('follower_id', $ids)->count()],
            ['Дружеские связи (строк)', DB::table('user_friendships')->whereIn('user_id', $ids)->count()],
            ['Диалоги', $this->conversationCount($ids)],
            ['Сообщения', Message::query()->whereIn('user_id', $ids)->count()],
        ];

        if ($community) {
            $stats[] = ["Участников «{$community->name}»", $community->fresh()->members_count];
        }

        $this->newLine();
        $this->info('=== Статистика по реальным данным в БД ===');
        $this->table(['Метрика', 'Значение'], $stats);

        $top = Post::query()
            ->whereIn('user_id', $ids)
            ->where('status', 'published')
            ->orderByDesc('reactions_count')
            ->orderByDesc('views_count')
            ->limit(5)
            ->get(['title', 'views_count', 'reactions_count', 'comments_count']);

        if ($top->isNotEmpty()) {
            $this->info('Топ постов по реакциям:');
            $this->table(
                ['Заголовок', 'Просмотры', 'Реакции', 'Комментарии'],
                $top->map(fn ($p) => [Str::limit($p->title, 40), $p->views_count, $p->reactions_count, $p->comments_count])->all(),
            );
        }
    }

    /** @param array<int,string> $emailsByUser */
    private function renderCredentials(array $users, string $password): void
    {
        $this->newLine();
        $this->info('=== Учётные данные (для ручной проверки на сайте) ===');
        $rows = [];
        foreach ($users as $u) {
            $rows[] = [$u->name, $u->email, $password];
        }
        $this->table(['Имя', 'Email', 'Пароль'], $rows);
    }

    /** @return array<int,int> */
    private function simUserIds(): array
    {
        return User::query()
            ->where('email', 'like', '%@'.self::EMAIL_DOMAIN)
            ->pluck('id')
            ->all();
    }

    private function conversationCount(array $ids): int
    {
        return (int) DB::table('conversation_participants')
            ->whereIn('user_id', $ids)
            ->distinct('conversation_id')
            ->count('conversation_id');
    }

    private function cleanup(): void
    {
        $this->warn('Очистка ранее созданных тестовых аккаунтов…');
        $ids = User::withTrashed()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('id')->all();
        if ($ids === []) {
            $this->line('Нечего очищать.');

            return;
        }

        $postIds = Post::withTrashed()->whereIn('user_id', $ids)->pluck('id')->all();
        $listingIds = Listing::query()->whereIn('user_id', $ids)->pluck('id')->all();
        $conversationIds = DB::table('conversation_participants')->whereIn('user_id', $ids)->pluck('conversation_id')->unique()->all();

        $this->safe(fn () => DB::table('post_reactions')->where(fn ($q) => $q->whereIn('post_id', $postIds)->orWhereIn('user_id', $ids))->delete());
        $this->safe(fn () => DB::table('post_bookmarks')->where(fn ($q) => $q->whereIn('post_id', $postIds)->orWhereIn('user_id', $ids))->delete());
        $this->safe(fn () => DB::table('post_reposts')->where(fn ($q) => $q->whereIn('original_post_id', $postIds)->orWhereIn('repost_post_id', $postIds)->orWhereIn('user_id', $ids))->delete());
        $this->safe(fn () => DB::table('post_media')->whereIn('post_id', $postIds)->delete());
        $this->safe(fn () => Comment::query()->where(fn ($q) => $q->whereIn('commentable_id', $postIds)->where('commentable_type', Post::class))->orWhereIn('user_id', $ids)->forceDelete());
        $this->safe(fn () => ModerationQueue::query()->where('moderatable_type', Post::class)->whereIn('moderatable_id', $postIds)->delete());
        $this->safe(fn () => Post::withTrashed()->whereIn('id', $postIds)->forceDelete());

        $this->safe(fn () => DB::table('listing_media')->whereIn('listing_id', $listingIds)->delete());
        $this->safe(fn () => Listing::query()->whereIn('id', $listingIds)->delete());

        $this->safe(fn () => Message::query()->whereIn('conversation_id', $conversationIds)->delete());
        $this->safe(fn () => DB::table('conversation_participants')->whereIn('conversation_id', $conversationIds)->delete());
        $this->safe(fn () => Conversation::query()->whereIn('id', $conversationIds)->delete());

        $this->safe(fn () => FriendRequest::query()->where(fn ($q) => $q->whereIn('from_user_id', $ids)->orWhereIn('to_user_id', $ids))->delete());
        $this->safe(fn () => DB::table('user_friendships')->where(fn ($q) => $q->whereIn('user_id', $ids)->orWhereIn('friend_id', $ids))->delete());
        $this->safe(fn () => DB::table('user_follows')->where(fn ($q) => $q->whereIn('follower_id', $ids)->orWhereIn('following_id', $ids))->delete());
        $this->safe(fn () => DB::table('user_interests')->whereIn('user_id', $ids)->delete());
        $this->safe(fn () => DB::table('community_members')->whereIn('user_id', $ids)->delete());
        $this->safe(fn () => DB::table('notification_preferences')->whereIn('user_id', $ids)->delete());
        $this->safe(fn () => DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete());
        $this->safe(fn () => UserProfile::query()->whereIn('user_id', $ids)->delete());
        $this->safe(fn () => User::withTrashed()->whereIn('id', $ids)->forceDelete());

        // Recompute community counters that may have drifted from the wipe.
        $this->safe(function (): void {
            foreach (Community::query()->get() as $c) {
                $c->members_count = DB::table('community_members')->where('community_id', $c->id)->count();
                $c->posts_count = Post::query()->where('community_id', $c->id)->where('status', 'published')->count();
                $c->save();
            }
        });

        $this->line('Очистка завершена ('.count($ids).' аккаунтов).');
    }

    private function safe(callable $fn): void
    {
        try {
            $fn();
        } catch (QueryException) {
            // Tolerate schema differences (e.g. an optional table absent).
        }
    }
}
