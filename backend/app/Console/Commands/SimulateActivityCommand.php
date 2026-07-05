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
use App\Models\PostMedia;
use App\Support\DemoImageFactory;
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
use Modules\Media\Services\MediaUploadService;
use Modules\User\Services\FriendService;
use Modules\User\Services\UserService;
use Illuminate\Support\Facades\File;

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
        {--users=12 : Number of users to simulate (10–15 recommended)}
        {--listings=0 : Total listings to publish (0 = random 16–28)}
        {--fresh : Delete previously simulated accounts and their content before running}
        {--password=password123 : Password assigned to every simulated user}
        {--report= : Save a markdown report to this path (default: storage/app/simulation-reports)}';

    protected $description = 'Simulate realistic multi-user activity (register, listings with photos, chat, comments) and print a report';

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
        ['Виктор Кузнецов', 'RC-багги 1/8, двигатели и электроника.'],
        ['Елена Фёдорова', 'Корабли и подводные лодки 1/350.'],
        ['Артём Громов', 'Краски Vallejo, аэрограф и расходники.'],
        ['Татьяна Белова', 'Декали и маски для авиации 1/72.'],
        ['Михаил Козлов', 'Запчасти и конверсии для бронетехники.'],
    ];

    /** @var array<string, list<array{0:string,1:string,2:int}>> title, description, price_cents */
    private const CATEGORY_LISTINGS = [
        'kits' => [
            ['Tamiya 1/35 T-34-76', 'Запечатанный набор Tamiya T-34-76. Литники без облоя, декаль на месте.', 420000],
            ['Dragon 1/35 Panther Ausf.G', 'Набор Dragon Panther, коробка без вмятин. Не собирался.', 580000],
            ['Airfix 1/72 Spitfire Mk.IX', 'Классика Airfix, все детали на месте. Отправка СДЭК.', 280000],
        ],
        'built' => [
            ['Собранный IS-2 1/35', 'Полностью собран и покрашен IS-2. Расшивка, погодка, матовый лак.', 950000],
            ['Модель корабля «Поларис» 1/144', 'Собранный парусник с такелажем. Стоит на подставке.', 1200000],
        ],
        'tools' => [
            ['Аэрограф H&S Evolution', 'Двойного действия, комплект сопел 0.2/0.4. Рабочий, без люфтов.', 890000],
            ['Набор пилок и напильников', '10 предметов для моделизма, б/у в хорошем состоянии.', 150000],
        ],
        'paints' => [
            ['Vallejo Model Color набор 16 цветов', 'Почти полные баночки, хранились вертикально.', 320000],
            ['AK Interactive weathering set', 'Набор масел и эффектов, открывался один раз.', 210000],
        ],
        'decals' => [
            ['Декали Як-3 1/48 Eduard', 'Не использовались, лист целый.', 90000],
            ['Маски для камуфляжа 1/35', 'Набор маски для танка, одноразовые.', 65000],
        ],
        'spare-parts' => [
            ['Гусеницы для Tiger I 1/35', 'Металлические траки Friul, новые.', 240000],
            ['Конверсия башни T-34', 'Резиновая конверсия, не установлена.', 180000],
        ],
        'literature' => [
            ['Монография «Bf 109»', 'Книга с чертежами и фото, состояние отличное.', 120000],
            ['Справочник по камуфляжам ВОВ', 'Справочник расцветок, твердый переплет.', 95000],
        ],
    ];

    private const BUYER_CHAT = [
        'Здравствуйте! Объявление ещё актуально?',
        'Да, актуально. Можете забрать или отправлю.',
        'Какая окончательная цена с доставкой?',
        'СДЭК до вашего города — около 400 ₽, могу скинуть точнее.',
        'Хорошо, беру. Когда сможете отправить?',
        'Завтра после обеда отправлю, скину трек.',
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

    /** @var array<int, array{name:string,email:string,uuid:string}> */
    private array $reportUsers = [];

    /** @var array<int, array{title:string,uuid:string,seller:string,price:int,category:string,has_photo:bool}> */
    private array $reportListings = [];

    private ?Community $reportCommunity = null;

    private int $listingTarget = 0;

    private bool $gdAvailable = false;

    public function handle(
        UserService $users,
        FriendService $friends,
        PostService $posts,
        PostInteractionService $interactions,
        CommentService $comments,
        ListingService $listings,
        ChatService $chat,
        CommunityService $communities,
        MediaUploadService $mediaUploads,
    ): int {
        $count = max(10, min(15, (int) $this->option('users')));
        $password = (string) $this->option('password');
        $listingOpt = (int) $this->option('listings');
        $this->listingTarget = $listingOpt > 0 ? max(16, min(28, $listingOpt)) : random_int(16, 28);
        $this->gdAvailable = extension_loaded('gd');
        $startedAt = now();

        if ($this->option('fresh')) {
            $this->cleanup();
        }

        $this->info("Режим: {$count} пользователей, {$this->listingTarget} объявлений, фото: ".($this->gdAvailable ? 'да (GD)' : 'нет (GD отсутствует)'));

        $this->info('Подготовка справочных данных…');
        $postCategories = PostCategory::query()->where('is_active', true)->pluck('id')->all();
        $listingCategories = ListingCategory::query()->where('is_active', true)->whereNull('parent_id')->get();
        $cityId = City::query()->value('id');
        $community = Community::query()->where('status', 'active')->orderByDesc('members_count')->first();
        $this->reportCommunity = $community;
        $postCategoryIds = $postCategories;

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

            $interestIds = collect($postCategoryIds)->shuffle()->take(min(3, count($postCategoryIds)))->values()->all();
            $this->step('interests.sync', fn () => $users->syncInterests($user, $interestIds));

            if ($this->gdAvailable) {
                $this->step('user.avatar', function () use ($user, $mediaUploads, $name, $users): void {
                    $profile = $user->profile;
                    if ($profile?->avatar_media_id) {
                        return;
                    }
                    $media = DemoImageFactory::upload($user, $mediaUploads, "Avatar: {$name}", 'avatar');
                    $users->updateProfile($user, ['avatar_media_id' => $media->uuid]);
                });
            }

            $this->reportUsers[] = [
                'name' => $user->name,
                'email' => $user->email,
                'uuid' => $user->uuid,
            ];
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
                    'category_id' => $postCategoryIds[array_rand($postCategoryIds)],
                    'title' => sprintf($tpl[0], $subject),
                    'body' => sprintf($tpl[1], $subject),
                    'hashtags' => ['моделизм', Str::slug($subject, '')],
                ]));

                if (! $post) {
                    continue;
                }

                if ($this->gdAvailable) {
                    $this->step('post.photo', function () use ($post, $author, $mediaUploads): void {
                        if ($post->mediaItems()->exists()) {
                            return;
                        }
                        $media = DemoImageFactory::upload($author, $mediaUploads, $post->title, 'post');
                        PostMedia::query()->create([
                            'post_id' => $post->id,
                            'media_id' => $media->id,
                            'sort_order' => 0,
                            'type' => 'image',
                        ]);
                    });
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

        // ---- Phase 4: listings + photos + views + favorites + buyer chat ----
        if ($listingCategories->isNotEmpty()) {
            $this->info("Публикация {$this->listingTarget} объявлений с фото по категориям…");
            /** @var array<int, Listing> $createdListings */
            $createdListings = [];
            $categoryList = $listingCategories->values()->all();

            for ($n = 0; $n < $this->listingTarget; $n++) {
                $owner = $created[$n % count($created)];
                /** @var ListingCategory $category */
                $category = $categoryList[$n % count($categoryList)];
                $payload = $this->listingPayloadForCategory($category);
                $mediaUuid = null;

                if ($this->gdAvailable) {
                    $media = $this->step('listing.photo', fn () => DemoImageFactory::upload(
                        $owner,
                        $mediaUploads,
                        $payload['title'].' · '.$category->name,
                        'listing',
                    ));
                    $mediaUuid = $media?->uuid;
                }

                $listing = $this->step('listing.create', fn () => $listings->create($owner, [
                    'category_id' => $payload['category_id'],
                    'title' => $payload['title'],
                    'description' => $payload['description'],
                    'price_cents' => $payload['price_cents'],
                    'city_id' => $cityId,
                    'delivery_methods' => ['СДЭК', 'Самовывоз'],
                    'media_ids' => $mediaUuid ? [$mediaUuid] : [],
                    'publish' => true,
                ]));

                if ($listing) {
                    $createdListings[] = $listing;
                    $this->reportListings[] = [
                        'title' => $listing->title,
                        'uuid' => $listing->uuid,
                        'seller' => $owner->email,
                        'price' => (int) round($listing->price_cents / 100),
                        'category' => $category->name,
                        'has_photo' => (bool) $mediaUuid,
                    ];
                }
            }

            foreach ($createdListings as $listing) {
                $sellerId = $listing->user_id;
                $viewers = collect($created)->reject(fn (User $u) => $u->id === $sellerId)->shuffle()->take(4);
                foreach ($viewers as $viewer) {
                    $this->step('listing.view', fn () => $listings->recordView($listing, $viewer));
                }

                $buyer = collect($created)->first(fn (User $u) => $u->id !== $sellerId);
                if ($buyer) {
                    $this->step('listing.favorite', fn () => $listings->addFavorite($listing, $buyer));

                    $seller = collect($created)->firstWhere('id', $sellerId);
                    if ($seller) {
                        $conversation = $this->step('chat.listing', fn () => $chat->findOrCreateDirect($buyer, $seller, $listing));
                        if ($conversation instanceof Conversation) {
                            foreach (self::BUYER_CHAT as $line => $text) {
                                $speaker = $line % 2 === 0 ? $buyer : $seller;
                                $this->step('chat.buyer', fn () => $chat->sendMessage($conversation, $speaker, $text));
                            }
                        }
                    }
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
                    'category_id' => $postCategoryIds[array_rand($postCategoryIds)],
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
        $reportPath = $this->saveMarkdownReport($startedAt, $password);

        $this->newLine();
        $this->info("Отчёт сохранён: {$reportPath}");

        return self::SUCCESS;
    }

    private function listingPayloadForCategory(ListingCategory $category): array
    {
        $slug = $category->slug ?: 'kits';
        $catalog = self::CATEGORY_LISTINGS[$slug] ?? self::CATEGORY_LISTINGS['kits'];
        $item = $catalog[array_rand($catalog)];

        return [
            'category_id' => $category->id,
            'title' => $item[0],
            'description' => $item[1],
            'price_cents' => $item[2],
        ];
    }

    private function saveMarkdownReport(\Illuminate\Support\Carbon $startedAt, string $password): string
    {
        $dir = $this->option('report') ?: storage_path('app/simulation-reports');
        if (str_ends_with((string) $dir, '.md')) {
            $path = (string) $dir;
            File::ensureDirectoryExists(dirname($path));
        } else {
            File::ensureDirectoryExists($dir);
            $path = rtrim((string) $dir, '/\\').'/activity-'.$startedAt->format('Y-m-d-His').'.md';
        }

        $ids = $this->simUserIds();
        $lines = [
            '# Отчёт симуляции активности ModelizmClub',
            '',
            '- **Дата:** '.$startedAt->toDateTimeString(),
            '- **Завершено:** '.now()->toDateTimeString(),
            '- **Пользователей:** '.count($this->reportUsers),
            '- **Объявлений:** '.count($this->reportListings).' (цель: '.$this->listingTarget.')',
            '- **Пароль всех аккаунтов:** `'.$password.'`',
            '- **Домен email:** `@'.self::EMAIL_DOMAIN.'`',
            '- **Данные не удаляются** (без флага `--fresh`)',
            '',
            '## Учётные записи',
            '',
            '| Имя | Email | UUID |',
            '|---|---|---|',
        ];

        foreach ($this->reportUsers as $u) {
            $lines[] = '| '.$u['name'].' | '.$u['email'].' | `'.$u['uuid'].'` |';
        }

        $lines[] = '';
        $lines[] = '## Объявления';
        $lines[] = '';
        $lines[] = '| Категория | Название | Цена ₽ | Фото | Продавец | UUID |';
        $lines[] = '|---|---|---:|---|---|---|';

        foreach ($this->reportListings as $l) {
            $lines[] = '| '.$l['category'].' | '.Str::limit($l['title'], 50).' | '.$l['price'].' | '.($l['has_photo'] ? 'да' : 'нет').' | '.$l['seller'].' | `'.$l['uuid'].'` |';
        }

        $lines[] = '';
        $lines[] = '## Результаты действий';
        $lines[] = '';
        $lines[] = '| Действие | OK | Ошибки |';
        $lines[] = '|---|---:|---:|';
        ksort($this->results);
        foreach ($this->results as $action => $r) {
            $lines[] = '| '.$action.' | '.$r['ok'].' | '.$r['fail'].' |';
        }

        if ($this->reportCommunity) {
            $lines[] = '';
            $lines[] = '## Сообщество';
            $lines[] = '';
            $lines[] = '- **Название:** '.$this->reportCommunity->name;
            $lines[] = '- **Участников после симуляции:** '.$this->reportCommunity->fresh()->members_count;
        }

        $lines[] = '';
        $lines[] = '## Статистика в БД';
        $lines[] = '';
        if ($ids !== []) {
            $postIds = Post::query()->whereIn('user_id', $ids)->pluck('id');
            $lines[] = '- Постов опубликовано: '.Post::query()->whereIn('user_id', $ids)->where('status', 'published')->whereNull('repost_of_id')->count();
            $lines[] = '- Комментариев к постам: '.Comment::query()->whereIn('commentable_id', $postIds)->where('commentable_type', Post::class)->count();
            $lines[] = '- Объявлений: '.Listing::query()->whereIn('user_id', $ids)->count();
            $lines[] = '- Сообщений в чатах: '.Message::query()->whereIn('user_id', $ids)->count();
            $lines[] = '- Избранных объявлений: '.DB::table('listing_favorites')->whereIn('user_id', $ids)->count();
        }

        $lines[] = '';
        $lines[] = '## Ручная проверка в интерфейсе';
        $lines[] = '';
        $lines[] = '1. Войти под любым `sim*@'.self::EMAIL_DOMAIN.'` / `'.$password.'`';
        $lines[] = '2. Лента — посты с фото, комментарии и ответы';
        $lines[] = '3. Объявления — каталог с фото по категориям';
        $lines[] = '4. Мессенджер — переписка «покупатель ↔ продавец» с привязкой к объявлению';
        $lines[] = '5. Сообщества — все sim-пользователи в клубе';

        File::put($path, implode("\n", $lines));

        return $path;
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
