<?php

namespace App\Console\Commands;

use App\Enums\ListingStatus;
use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\City;
use App\Models\Listing;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\Demo\DemoChannelsSection;
use App\Support\Demo\DemoChatsSection;
use App\Support\Demo\DemoCommunitiesSection;
use App\Support\Demo\DemoCoverageSection;
use App\Support\Demo\DemoFriendsSection;
use App\Support\Demo\DemoPostsSection;
use App\Support\Demo\DemoSection;
use App\Support\Demo\DemoUsersSection;
use App\Support\DemoImageFactory;
use App\Support\DemoListingCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Admin\Services\UserFullDeletionService;
use Modules\Catalog\Services\CatalogService;
use Modules\Listing\Services\ListingService;
use Modules\Media\Services\MediaUploadService;

/**
 * Тестовые объявления в подкатегориях направлений — чтобы каталог, фильтры
 * и страницы направлений проверялись на настоящих данных, а не на шести
 * лотах.
 *
 * ПОМЕТКА. Продавцы — четыре аккаунта на домене `@demo.modelizmclub.ru`: по
 * нему объявления находятся и удаляются, как у `app:simulate-activity`
 * (`@sim.modelizmclub.ru`). Первая строка каждого описания — «Тестовое
 * объявление — не продаётся.»: лоты публичные, на проде, с оформлением
 * безопасной сделки, и живой покупатель должен видеть, что покупать нечего.
 *
 * ПУТЬ. Объявление создаётся тем же `ListingService::create`, что и форма, —
 * с `taxonomy_id` узла направления, так что пара «категория/подкатегория»
 * каталога и её зеркало получаются как у живого продавца. Создаётся
 * черновиком, минуя оплату размещения, и публикуется `markPublished` — тем
 * же, чем модерация одобряет объявление. Платежей не появляется.
 *
 * КАРТИНКИ — `DemoImageFactory`: цветной фон и подпись, через обычный
 * конвейер медиа. Это заглушки, а не фотографии.
 *
 * УДАЛЕНИЕ — `--purge`: продавцы удаляются `UserFullDeletionService`, их
 * объявления и привязки фото уходят каскадом. Если по демо-объявлению есть
 * безопасная сделка, команда отказывается: каскад удалил бы и сделку живого
 * покупателя. Файлы картинок в хранилище остаются — так же, как при любом
 * полном удалении пользователя.
 *
 * Идемпотентна: лот с тем же заголовком у демо-продавцов пропускается.
 */
class DemoListingsCommand extends Command
{
    protected $signature = 'listings:demo
        {--dry-run : показать план, ничего не писать}
        {--purge : удалить демо-данные целиком}
        {--only=* : только эти узлы направлений (slug), для раздела объявлений}
        {--section=* : только эти разделы: '.self::SECTION_LIST.'}
        {--batch=25 : сколько единиц подряд без паузы}
        {--pause=2 : пауза между порциями, секунд}
        {--force : при --purge удалить, даже если внутри демо-данных есть чужое}
        {--fill-listings-everywhere : добирать объявления и в неторговых узлах дерева}';

    protected $description = 'Демо-набор: люди, дружба, записи, сообщества, каналы, переписка, объявления, полнота дерева';

    /** Порядок важен: следующий раздел опирается на созданное предыдущим. */
    public const SECTIONS = ['users', 'friends', 'posts', 'communities', 'channels', 'chats', 'listings', 'coverage'];

    private const SECTION_LIST = 'users, friends, posts, communities, channels, chats, listings, coverage';

    public const EMAIL_DOMAIN = 'demo.modelizmclub.ru';

    public const MARKER = 'Тестовое объявление — не продаётся.';

    /** @var list<array{0: string, 1: string}> */
    private const SELLERS = [
        ['seller1', 'Андрей Лебедев (демо)'],
        ['seller2', 'Ольга Смирнова (демо)'],
        ['seller3', 'Игорь Павлов (демо)'],
        ['seller4', 'Марина Орлова (демо)'],
    ];

    /** Не СДЭК: ему нужен профиль доставки продавца. */
    private const DELIVERY = ['Почта России', 'Самовывоз'];

    private const PICKUP_ADDRESS = 'Центр города, по договорённости';

    private const PHOTOS_PER_LISTING = 2;

    public function handle(ListingService $listings, MediaUploadService $uploads, UserFullDeletionService $deletion): int
    {
        if ($this->option('purge')) {
            return $this->purge($deletion);
        }

        $chosen = $this->chosenSections();
        if ($chosen === null) {
            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $started = microtime(true);
        $totals = ['создать' => 0, 'создано' => 0];

        foreach ($chosen as $key) {
            if ($key === 'listings') {
                $code = $this->seed($listings, $uploads);
                if ($code !== self::SUCCESS) {
                    return $code;
                }

                continue;
            }

            $section = $this->section($key);
            $plan = $section->plan();

            $this->newLine();
            $this->line("<options=bold>{$section->title()}</>");
            $this->table($section->columns(), $plan['rows']);
            $this->line("  создать: {$plan['create']}, уже есть: {$plan['exists']}".
                (isset($plan['photos']) ? ", картинок: {$plan['photos']}" : ''));

            foreach ($section->warnings() as $warning) {
                $this->warn("  ! {$warning}");
            }
            $totals['создать'] += $plan['create'];

            if ($dryRun) {
                continue;
            }

            $totals['создано'] += $this->runSection($section);
        }

        $this->newLine();
        if ($dryRun) {
            $this->info("Сухой прогон: будет создано единиц {$totals['создать']}. В базу ничего не записано.");

            return self::SUCCESS;
        }

        $this->info(sprintf('Создано единиц %d за %s.', $totals['создано'], $this->human(microtime(true) - $started)));

        return self::SUCCESS;
    }

    /**
     * Создание порциями с паузами.
     *
     * ПОЧЕМУ НЕ РАЗОМ. Каждая картинка проходит конвейер медиа, а тот собирает
     * четыре размера в трёх форматах. Сотня картинок подряд занимает все ядра,
     * и это те же ядра, на которых сервер отвечает живым людям. Пауза между
     * порциями возвращает процессор сайту.
     */
    private function runSection(DemoSection $section): int
    {
        $batch = max(1, (int) $this->option('batch'));
        $pause = max(0, (int) $this->option('pause'));
        $done = 0;
        $started = microtime(true);

        $made = $section->create(function (string $what) use (&$done, $batch, $pause, $started): void {
            $done++;
            if ($done % 10 === 0) {
                $this->line(sprintf('    %4d · %s · %s', $done, $this->human(microtime(true) - $started), mb_substr($what, 0, 48)));
            }
            if ($pause > 0 && $done % $batch === 0) {
                sleep($pause);
            }
        });

        $this->line(sprintf('  готово: %d за %s', $made, $this->human(microtime(true) - $started)));

        return $made;
    }

    /** @return list<string>|null */
    private function chosenSections(): ?array
    {
        $asked = array_values(array_filter((array) $this->option('section')));

        /*
         * `--only` называет узлы дерева и относится только к объявлениям.
         * Раньше команда умела одни объявления, и вызов с `--only` означал
         * «сделай объявления вот в этих узлах». Значение сохраняем: без явного
         * `--section` такой вызов по-прежнему делает только объявления, а не
         * весь набор.
         */
        if ($asked === [] && array_values(array_filter((array) $this->option('only'))) !== []) {
            return ['listings'];
        }

        if ($asked === []) {
            return self::SECTIONS;
        }

        $unknown = array_diff($asked, self::SECTIONS);
        if ($unknown !== []) {
            $this->error('Неизвестные разделы: '.implode(', ', $unknown));
            $this->line('Известные: '.implode(', ', self::SECTIONS));

            return null;
        }

        // Порядок всегда свой, а не тот, в котором их назвали: разделы зависят
        // друг от друга, и «chats,users» без пересортировки создаст переписку
        // между несуществующими людьми.
        return array_values(array_filter(self::SECTIONS, fn (string $k): bool => in_array($k, $asked, true)));
    }

    private function section(string $key): DemoSection
    {
        if ($key === 'coverage') {
            $coverage = app(DemoCoverageSection::class);
            $coverage->fillListingsEverywhere((bool) $this->option('fill-listings-everywhere'));

            return $coverage;
        }

        return app(match ($key) {
            'users' => DemoUsersSection::class,
            'friends' => DemoFriendsSection::class,
            'posts' => DemoPostsSection::class,
            'communities' => DemoCommunitiesSection::class,
            'channels' => DemoChannelsSection::class,
            'chats' => DemoChatsSection::class,
            'coverage' => DemoCoverageSection::class,
            default => throw new \InvalidArgumentException("Неизвестный раздел {$key}"),
        });
    }

    private function human(float $seconds): string
    {
        return $seconds < 60
            ? sprintf('%.0f с', $seconds)
            : sprintf('%d мин %02d с', (int) ($seconds / 60), (int) $seconds % 60);
    }

    private function seed(ListingService $listings, MediaUploadService $uploads): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $catalog = $this->catalog();
        if ($catalog === null) {
            return self::FAILURE;
        }

        $sellerIds = $this->sellerIds();
        $rows = [];
        $problems = [];
        $plan = [];

        foreach ($catalog as $slug => $items) {
            $node = PostCategory::query()->where('slug', $slug)->where('is_active', true)->first();
            if (! $node) {
                $problems[] = "узла «{$slug}» нет или он выключен";

                continue;
            }

            $missing = array_values(array_filter(
                $items,
                fn (array $item): bool => ! $this->exists($sellerIds, $item[0]),
            ));
            $plan[] = [$node, $missing];
            $rows[] = [$node->path, count($items), count($items) - count($missing), $this->mirrorNote($node)];
        }

        $this->table(['узел', 'лотов', 'уже есть', 'каталог'], $rows);

        if ($problems !== []) {
            foreach ($problems as $p) {
                $this->error($p);
            }
            $this->error('Ничего не записано.');

            return self::FAILURE;
        }

        $total = array_sum(array_map(fn (array $p): int => count($p[1]), $plan));
        $this->line('Продавцы: '.implode(', ', array_map(fn (array $s): string => "{$s[0]}@".self::EMAIL_DOMAIN, self::SELLERS)));
        $this->line('Пометка в описании: «'.self::MARKER.'»');

        if ($dryRun) {
            $this->info("Сухой прогон: будет создано объявлений {$total}, в базу ничего не записано.");

            return self::SUCCESS;
        }

        if ($total > 0 && ! extension_loaded('gd')) {
            $this->error('Нет расширения GD — картинки не из чего сделать.');

            return self::FAILURE;
        }

        $sellers = array_map(fn (array $s): User => $this->seller($s[0], $s[1]), self::SELLERS);
        $cityIds = City::query()->orderBy('id')->limit(25)->pluck('id')->all();

        $n = 0;
        foreach ($plan as [$node, $items]) {
            foreach ($items as [$title, $description, $priceRub, $condition]) {
                $seller = $sellers[$n % count($sellers)];

                $mediaIds = [];
                for ($i = 1; $i <= self::PHOTOS_PER_LISTING; $i++) {
                    $media = DemoImageFactory::upload($seller, $uploads, "{$title} · {$node->name} · {$i}", 'listing');
                    $mediaIds[] = $media->uuid;
                }

                $listing = $listings->create($seller, [
                    'taxonomy_id' => $node->id,
                    'title' => $title,
                    'description' => self::MARKER."\n\n".$description,
                    'price_cents' => $priceRub * 100,
                    'condition' => $condition,
                    'city_id' => $cityIds === [] ? null : $cityIds[$n % count($cityIds)],
                    'delivery_methods' => self::DELIVERY,
                    'pickup_address' => self::PICKUP_ADDRESS,
                    'media_ids' => $mediaIds,
                    'publish' => false,
                ]);
                $listings->markPublished($listing);

                $n++;
            }
        }

        CatalogService::flushCache();
        $this->info("Создано объявлений: {$n}.");

        return $this->verifySeed(array_keys($catalog)) ? self::SUCCESS : self::FAILURE;
    }

    /** @return array<string, list<array{0: string, 1: string, 2: int, 3: string}>>|null */
    private function catalog(): ?array
    {
        $only = array_values(array_filter((array) $this->option('only')));
        if ($only === []) {
            return DemoListingCatalog::ITEMS;
        }

        $unknown = array_diff($only, array_keys(DemoListingCatalog::ITEMS));
        if ($unknown !== []) {
            $this->error('Нет лотов для узлов: '.implode(', ', $unknown));

            return null;
        }

        return array_intersect_key(DemoListingCatalog::ITEMS, array_flip($only));
    }

    /**
     * Где узел в каталоге сейчас. Первое объявление в узле достраивает его
     * зеркало (`ensureListingMirror`) — если зеркала нет или оно висит не на
     * своём пути, это видно здесь до записи.
     */
    private function mirrorNote(PostCategory $node): string
    {
        $byPath = DB::table('listing_categories')->where('path', $node->path)->value('id');
        if ($byPath) {
            return "есть, id {$byPath}";
        }

        $bySlug = DB::table('listing_categories')->where('slug', $node->slug)->first(['id', 'path']);

        return $bySlug
            ? "id {$bySlug->id} на пути {$bySlug->path} — будет перевешен"
            : 'нет — заведётся с первым объявлением';
    }

    /** @param  list<int>  $sellerIds */
    private function exists(array $sellerIds, string $title): bool
    {
        return $sellerIds !== []
            && Listing::withTrashed()->whereIn('user_id', $sellerIds)->where('title', $title)->exists();
    }

    /** @return list<int> */
    private function sellerIds(): array
    {
        return User::withTrashed()
            ->where('email', 'like', '%@'.self::EMAIL_DOMAIN)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** По образцу `SimulateActivityCommand::makeUser`: пароль случайный и нигде не печатается. */
    private function seller(string $local, string $name): User
    {
        $email = $local.'@'.self::EMAIL_DOMAIN;
        $user = User::withTrashed()->where('email', $email)->first()
            ?? User::create([
                'name' => $name,
                'email' => $email,
                'password' => Str::random(40),
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'registration_track' => RegistrationTrack::Listing,
                'email_verified_at' => now(),
            ]);

        if (! $user->profile) {
            $base = Str::slug($name) ?: 'demo-seller';
            $slug = $base;
            $suffix = 1;
            while (UserProfile::query()->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$suffix++;
            }
            UserProfile::create([
                'user_id' => $user->id,
                'display_name' => $name,
                'slug' => $slug,
                'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
            ]);
            $user->load('profile');
        }

        return $user;
    }

    /**
     * Проверка по факту в таблицах, а не тем путём, что писал: в каждом узле
     * опубликовано не меньше двух демо-объявлений — по зеркалу каталога с
     * тем же путём, что у узла; у каждого есть фото и пометка.
     *
     * @param  list<string>  $slugs
     */
    private function verifySeed(array $slugs): bool
    {
        $this->line('Проверка по факту в таблицах:');
        $sellerIds = $this->sellerIds();
        $failures = [];

        foreach ($slugs as $slug) {
            $path = DB::table('post_categories')->where('slug', $slug)->value('path');
            $listingCategoryId = $path ? DB::table('listing_categories')->where('path', $path)->value('id') : null;
            if (! $listingCategoryId) {
                $failures[] = "«{$slug}»: нет зеркала в каталоге с путём {$path}";

                continue;
            }

            $ids = DB::table('listings')
                ->whereIn('user_id', $sellerIds)
                ->whereNull('deleted_at')
                ->where('status', ListingStatus::Published->value)
                ->where('subcategory_id', $listingCategoryId)
                ->pluck('id');
            if ($ids->count() < 2) {
                $failures[] = "«{$path}»: опубликовано {$ids->count()}, нужно не меньше двух";
            }

            $withoutPhoto = $ids->reject(fn ($id) => DB::table('listing_media')->where('listing_id', $id)->exists())->count();
            if ($withoutPhoto > 0) {
                $failures[] = "«{$path}»: без фото {$withoutPhoto}";
            }

            $unmarked = DB::table('listings')->whereIn('id', $ids)->where('description', 'not like', self::MARKER.'%')->count();
            if ($unmarked > 0) {
                $failures[] = "«{$path}»: без пометки {$unmarked}";
            }
        }

        foreach ($failures as $f) {
            $this->error('  '.$f);
        }
        if ($failures === []) {
            $this->info('  в каждом узле не меньше двух опубликованных демо-объявлений, с фото и пометкой');
        }

        return $failures === [];
    }

    /**
     * Удаление всего набора.
     *
     * ЧТО УХОДИТ КАСКАДОМ. `UserFullDeletionService::purge` сам сносит каналы,
     * где демо-человек владелец, и сообщества, где он создатель или владелец в
     * сводной таблице. Поэтому команде достаточно удалить людей — записи,
     * объявления, комментарии, реакции и участие уходят вместе с ними.
     *
     * ЗАЩИТА. Демо-сообщество мог найти живой человек: вступить, написать на
     * стену, оставить комментарий под демо-записью. Снос владельца удалит и
     * это. По умолчанию команда в таком случае отказывается и печатает, что
     * именно нашла; продолжить можно `--force`, но уже осознанно.
     *
     * Безопасные сделки остаются отдельным, более жёстким случаем: их не
     * разрешает даже `--force` — там деньги живого покупателя.
     */
    private function purge(UserFullDeletionService $deletion): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');

        $users = User::withTrashed()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->get();
        $userIds = $users->pluck('id')->all();

        if ($userIds === []) {
            $this->info('Демо-данных нет: ни одной учётной записи на '.self::EMAIL_DOMAIN.'.');

            return self::SUCCESS;
        }

        $listingIds = Listing::withTrashed()->whereIn('user_id', $userIds)->pluck('id')->all();
        $postIds = DB::table('posts')->whereIn('user_id', $userIds)->pluck('id')->all();
        $communityIds = DB::table('communities')->whereIn('created_by', $userIds)->pluck('id')->all();
        $channelIds = DB::table('channels')->whereIn('owner_id', $userIds)->pluck('id')->all();

        $this->table(['что', 'сколько'], [
            ['люди', count($userIds)],
            ['объявления', count($listingIds)],
            ['записи', count($postIds)],
            ['сообщества', count($communityIds)],
            ['каналы', count($channelIds)],
            ['фото объявлений', DB::table('listing_media')->whereIn('listing_id', $listingIds)->count()],
            ['личные диалоги', $this->demoDirectConversations($userIds)->count()],
        ]);

        $deals = DB::table('safe_deals')
            ->where(fn ($q) => $q->whereIn('listing_id', $listingIds)
                ->orWhereIn('seller_id', $userIds)
                ->orWhereIn('buyer_id', $userIds))
            ->count();

        if ($deals > 0) {
            $this->error("По демо-объявлениям есть безопасные сделки: {$deals}. Удаление продавца сотрёт их каскадом — разберите сделки вручную. Ничего не удалено.");

            return self::FAILURE;
        }

        $foreign = $this->foreignContent($userIds, $communityIds, $channelIds, $postIds);
        $foreignTotal = array_sum($foreign);

        if ($foreignTotal > 0) {
            $this->newLine();
            $this->warn('Внутри демо-данных есть чужое — оно тоже будет удалено:');
            foreach ($foreign as $what => $count) {
                if ($count > 0) {
                    $this->line("  {$what}: {$count}");
                }
            }

            if (! $force) {
                $this->error('Ничего не удалено. Разберите найденное или повторите с --force, если это действительно можно терять.');

                return self::FAILURE;
            }
        }

        if ($dryRun) {
            $this->info('Сухой прогон: ничего не удалено.');

            return self::SUCCESS;
        }

        $conversationIds = $this->demoDirectConversations($userIds)->pluck('id')->all();

        foreach ($users as $user) {
            $deletion->purge($user);
        }

        // Личные диалоги, где обе стороны — демо-люди: участники ушли вместе с
        // людьми, но сама беседа осталась бы пустой строкой в списке.
        if ($conversationIds !== []) {
            DB::table('messages')->whereIn('conversation_id', $conversationIds)->delete();
            DB::table('conversation_participants')->whereIn('conversation_id', $conversationIds)->delete();
            DB::table('conversations')->whereIn('id', $conversationIds)->delete();
        }

        CatalogService::flushCache();

        $leftUsers = User::withTrashed()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->count();
        $leftListings = Listing::withTrashed()->whereIn('id', $listingIds)->count();
        $leftPosts = DB::table('posts')->whereIn('id', $postIds)->count();
        $leftCommunities = DB::table('communities')->whereIn('id', $communityIds)->count();
        $leftChannels = DB::table('channels')->whereIn('id', $channelIds)->count();

        $this->line("Проверка: людей {$leftUsers}, объявлений {$leftListings}, записей {$leftPosts}, сообществ {$leftCommunities}, каналов {$leftChannels}.");

        if ($leftUsers + $leftListings + $leftPosts + $leftCommunities + $leftChannels > 0) {
            $this->error('Удалено не всё.');

            return self::FAILURE;
        }

        $this->info('Удалено. Файлы картинок в хранилище остаются, как при любом полном удалении пользователя.');

        return self::SUCCESS;
    }

    /**
     * Чужое внутри демо-данных.
     *
     * @param  list<int>  $userIds
     * @param  list<int>  $communityIds
     * @param  list<int>  $channelIds
     * @param  list<int>  $postIds
     * @return array<string, int>
     */
    private function foreignContent(array $userIds, array $communityIds, array $channelIds, array $postIds): array
    {
        $notDemo = fn ($q) => $q->whereNotIn('user_id', $userIds);

        return [
            'записи живых людей в демо-сообществах' => $communityIds === [] ? 0 : DB::table('posts')
                ->whereIn('community_id', $communityIds)
                ->whereNotIn('user_id', $userIds)
                ->whereNull('deleted_at')
                ->count(),
            'участники демо-сообществ со стороны' => $communityIds === [] ? 0 : DB::table('community_members')
                ->whereIn('community_id', $communityIds)
                ->whereNotIn('user_id', $userIds)
                ->count(),
            'подписчики демо-каналов со стороны' => $channelIds === [] ? 0 : DB::table('channel_subscriptions')
                ->whereIn('channel_id', $channelIds)
                ->whereNotIn('user_id', $userIds)
                ->count(),
            'комментарии живых людей под демо-записями' => $postIds === [] ? 0 : DB::table('comments')
                ->where('commentable_type', \App\Models\Post::class)
                ->whereIn('commentable_id', $postIds)
                ->whereNotIn('user_id', $userIds)
                ->whereNull('deleted_at')
                ->count(),
        ];
    }

    /**
     * Личные диалоги, в которых нет никого, кроме демо-людей.
     *
     * @param  list<int>  $userIds
     * @return \Illuminate\Support\Collection<int, object>
     */
    private function demoDirectConversations(array $userIds)
    {
        return DB::table('conversations as c')
            ->where('c.type', 'direct')
            ->whereExists(fn ($q) => $q->from('conversation_participants as p')
                ->whereColumn('p.conversation_id', 'c.id')
                ->whereIn('p.user_id', $userIds))
            ->whereNotExists(fn ($q) => $q->from('conversation_participants as p2')
                ->whereColumn('p2.conversation_id', 'c.id')
                ->whereNotIn('p2.user_id', $userIds))
            ->get(['c.id']);
    }
}
