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
        {--purge : удалить демо-продавцов и все их объявления}
        {--only=* : только эти узлы направлений (slug)}';

    protected $description = 'Тестовые объявления в подкатегориях направлений; продавцы @demo.modelizmclub.ru';

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
        return $this->option('purge')
            ? $this->purge($deletion)
            : $this->seed($listings, $uploads);
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

    private function purge(UserFullDeletionService $deletion): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $users = User::withTrashed()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->get();
        $userIds = $users->pluck('id')->all();
        $listingIds = Listing::withTrashed()->whereIn('user_id', $userIds)->pluck('id')->all();

        $deals = DB::table('safe_deals')
            ->where(fn ($q) => $q->whereIn('listing_id', $listingIds)
                ->orWhereIn('seller_id', $userIds)
                ->orWhereIn('buyer_id', $userIds))
            ->count();
        $favorites = DB::table('listing_favorites')->whereIn('listing_id', $listingIds)->count();
        $media = DB::table('listing_media')->whereIn('listing_id', $listingIds)->count();

        $this->line("Демо-продавцов: {$users->count()}, объявлений: ".count($listingIds).", фото: {$media}, в избранном у людей: {$favorites}.");

        if ($deals > 0) {
            $this->error("По демо-объявлениям есть безопасные сделки: {$deals}. Удаление продавца сотрёт их каскадом — разберите сделки вручную. Ничего не удалено.");

            return self::FAILURE;
        }

        if ($dryRun) {
            $this->info('Сухой прогон: ничего не удалено.');

            return self::SUCCESS;
        }

        foreach ($users as $user) {
            $deletion->purge($user);
        }
        CatalogService::flushCache();

        $leftUsers = User::withTrashed()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->count();
        $leftListings = Listing::withTrashed()->whereIn('id', $listingIds)->count();
        $leftMedia = DB::table('listing_media')->whereIn('listing_id', $listingIds)->count();

        $this->line("Проверка: продавцов {$leftUsers}, объявлений {$leftListings}, привязок фото {$leftMedia}.");
        if ($leftUsers + $leftListings + $leftMedia > 0) {
            $this->error('Удалено не всё.');

            return self::FAILURE;
        }

        $this->info('Удалено. Файлы картинок в хранилище остаются, как при любом полном удалении пользователя.');

        return self::SUCCESS;
    }
}
