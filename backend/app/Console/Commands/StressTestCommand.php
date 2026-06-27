<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\City;
use App\Models\Conversation;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Media;
use App\Models\Message;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Factory as Http;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Chat\Services\ChatService;
use Modules\Listing\Services\ListingService;
use Modules\Media\Services\MediaUploadService;
use Modules\User\Services\UserService;

/**
 * High-volume load & stability harness.
 *
 * Drives the real service layer with a large population to verify that writes
 * and reads stay correct and stored under pressure, with special attention to
 * media: every listing photo is a real JPEG uploaded to object storage, then
 * read back to prove it persisted, processed (dimensions) and is servable.
 *
 * Scenario (defaults): 150 users hold direct dialogs; the first 40 users each
 * publish 19 listings, each carrying real photos, and also chat. Per-operation
 * latency (avg / p95 / max) and success rates are reported, plus a proof of the
 * at-rest message-encryption capability.
 *
 * Accounts use the @stress.modelizmclub.ru domain so --fresh wipes them (and
 * their uploaded media on object storage) cleanly.
 */
class StressTestCommand extends Command
{
    protected $signature = 'app:stress-test
        {--users=150 : Total users to create}
        {--sellers=40 : How many users publish listings}
        {--listings-per-seller=19 : Listings each seller publishes}
        {--photos=2 : Real photos uploaded per listing}
        {--messages=8 : Messages exchanged per dialog}
        {--img-width=900 : Generated photo width}
        {--img-height=675 : Generated photo height}
        {--encrypt : Store all message bodies encrypted at rest for this run}
        {--fresh : Wipe previous stress accounts, content and uploaded media first}
        {--keep-media : On --fresh, do not delete uploaded objects from storage}
        {--password=password : Password for every account}';

    protected $description = 'Large-scale load/stability test: dialogs + listings with real photos, latency metrics and encryption proof';

    private const EMAIL_DOMAIN = 'stress.modelizmclub.ru';

    /** @var array<string, array{type:string, ok:int, fail:int, durs:array<int,float>, errors:array<int,string>}> */
    private array $results = [];

    /** @var array<int, int> Media ids created this run (for read-back + storage report). */
    private array $mediaIds = [];

    public function handle(
        UserService $users,
        ChatService $chat,
        ListingService $listings,
        MediaUploadService $media,
        Http $http,
    ): int {
        $userCount = max(1, (int) $this->option('users'));
        $sellers = max(0, (int) $this->option('sellers'));
        $perSeller = max(0, (int) $this->option('listings-per-seller'));
        $photos = max(0, (int) $this->option('photos'));
        $msgs = max(1, (int) $this->option('messages'));
        $password = (string) $this->option('password');
        $encrypt = (bool) $this->option('encrypt');

        if (! extension_loaded('gd')) {
            $this->error('Расширение GD недоступно — генерация фото невозможна.');

            return self::FAILURE;
        }

        if ($encrypt) {
            config(['chat.encrypt_messages' => true]);
            $this->warn('Шифрование сообщений ВКЛЮЧЕНО для этого прогона (хранение в БД — шифротекст).');
        }

        if ($this->option('fresh')) {
            $this->cleanup();
        }

        $listingCategories = ListingCategory::query()->where('is_active', true)->pluck('id')->all();
        $cityId = City::query()->value('id');

        if ($sellers > 0 && $listingCategories === []) {
            $this->error('Нет активных категорий объявлений — запустите сидеры.');

            return self::FAILURE;
        }

        // ---- Phase 1: users ---------------------------------------------------
        $this->info("Создание {$userCount} пользователей…");
        $bar = $this->output->createProgressBar($userCount);
        /** @var array<int, User> $created */
        $created = [];
        for ($i = 1; $i <= $userCount; $i++) {
            $email = 'stress'.$i.'@'.self::EMAIL_DOMAIN;
            $name = 'Нагрузочный '.$i;
            $user = $this->step('user.create', 'write', fn () => $this->makeUser($email, $name, $password));
            if ($user) {
                $created[] = $user;
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();

        if ($created === []) {
            $this->error('Не удалось создать пользователей.');

            return self::FAILURE;
        }
        $n = count($created);

        // ---- Phase 2: dialogs (write messages, then read them back) -----------
        $this->info("Диалоги: переписка по {$msgs} сообщений…");
        $bar = $this->output->createProgressBar($n);
        /** @var array<int, Conversation> $conversations */
        $conversations = [];
        foreach ($created as $i => $sender) {
            $recipient = $created[($i + 1) % $n];
            if ($recipient->id === $sender->id) {
                $bar->advance();

                continue;
            }

            $conversation = $this->step('dialog.open', 'write', fn () => $chat->findOrCreateDirect($sender, $recipient));
            if (! $conversation instanceof Conversation) {
                $bar->advance();

                continue;
            }
            $conversations[] = [$conversation, $sender];

            for ($m = 0; $m < $msgs; $m++) {
                $speaker = $m % 2 === 0 ? $sender : $recipient;
                $text = 'Сообщение #'.($m + 1).' от '.$speaker->name.' — '.Str::random(24);
                $this->step('chat.message', 'write', fn () => $chat->sendMessage($conversation, $speaker, $text));
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();

        // Read-back: fetch each dialog's messages and confirm they are stored.
        $this->info('Чтение диалогов (проверка получения)…');
        foreach ($conversations as [$conversation, $owner]) {
            $this->step('chat.read', 'read', function () use ($chat, $conversation, $owner, $msgs): void {
                $page = $chat->listMessages($conversation->uuid, $owner, 100);
                if ($page->total() < $msgs) {
                    throw new \RuntimeException("ожидалось >= {$msgs}, получено {$page->total()}");
                }
            });
        }

        // ---- Phase 3: sellers publish listings with real photos ---------------
        /** @var array<int, string> $listingUuids */
        $listingUuids = [];
        if ($sellers > 0 && $perSeller > 0) {
            $sellerUsers = array_slice($created, 0, min($sellers, $n));
            $total = count($sellerUsers) * $perSeller;
            $this->info(count($sellerUsers)." продавцов × {$perSeller} объявлений × {$photos} фото (всего объявлений: {$total})…");
            $bar = $this->output->createProgressBar($total);
            $w = max(64, (int) $this->option('img-width'));
            $h = max(64, (int) $this->option('img-height'));

            foreach ($sellerUsers as $sIdx => $seller) {
                for ($j = 1; $j <= $perSeller; $j++) {
                    $mediaUuids = [];
                    for ($k = 1; $k <= $photos; $k++) {
                        $label = "stress s{$sIdx} l{$j} p{$k}";
                        $uploaded = $this->step('photo.upload', 'write', function () use ($media, $seller, $label, $w, $h): Media {
                            $path = $this->generateJpeg($label, $w, $h);
                            try {
                                $file = new UploadedFile($path, 'photo.jpg', 'image/jpeg', null, true);

                                return $media->storeUploadedFile($seller, $file, 'listing');
                            } finally {
                                @unlink($path);
                            }
                        });
                        if ($uploaded instanceof Media) {
                            $mediaUuids[] = $uploaded->uuid;
                            $this->mediaIds[] = $uploaded->id;
                        }
                    }

                    $subject = 'набор '.Str::upper(Str::random(4)).' 1/'.(24 + $j);
                    $listing = $this->step('listing.create', 'write', fn () => $listings->create($seller, [
                        'category_id' => $listingCategories[array_rand($listingCategories)],
                        'title' => 'Продам '.$subject.' (#'.$j.')',
                        'description' => 'Тестовое объявление продавца. '.Str::random(120),
                        'price_cents' => random_int(50, 1500) * 100,
                        'city_id' => $cityId,
                        'publish' => true,
                        'media_ids' => $mediaUuids,
                    ]));
                    if ($listing instanceof Listing) {
                        $listingUuids[] = $listing->uuid;
                    }
                    $bar->advance();
                }
            }
            $bar->finish();
            $this->newLine();

            // Read-back: photos persisted, processed and servable.
            $this->verifyPhotos($http);

            // Read-back: a sample of listings loads with its media.
            $this->info('Чтение объявлений с фото (проверка получения)…');
            $sample = collect($listingUuids)->shuffle()->take(min(60, count($listingUuids)));
            foreach ($sample as $uuid) {
                $this->step('listing.read', 'read', function () use ($listings, $uuid): void {
                    $listing = $listings->show($uuid);
                    if ($listing->mediaItems->isEmpty()) {
                        throw new \RuntimeException('у объявления нет медиа');
                    }
                });
            }
        }

        // ---- Phase 4: encryption capability proof -----------------------------
        $this->proveEncryption($chat, $created, $encrypt);

        // ---- Reports ----------------------------------------------------------
        $this->newLine();
        $this->renderStability();
        $this->renderStorage($encrypt);

        return self::SUCCESS;
    }

    // ---------------------------------------------------------------------------

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
            'email_verified_at' => now(),
        ]);

        $this->createProfile($user);

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

    /** Generate a unique, valid JPEG on disk and return its path. */
    private function generateJpeg(string $label, int $w, int $h): string
    {
        $img = imagecreatetruecolor($w, $h);
        $bg = imagecolorallocate($img, random_int(20, 180), random_int(20, 180), random_int(20, 180));
        imagefilledrectangle($img, 0, 0, $w, $h, $bg);

        for ($i = 0; $i < 10; $i++) {
            $c = imagecolorallocate($img, random_int(0, 255), random_int(0, 255), random_int(0, 255));
            imagefilledellipse($img, random_int(0, $w), random_int(0, $h), random_int(40, 240), random_int(40, 240), $c);
        }

        $fg = imagecolorallocate($img, 255, 255, 255);
        imagestring($img, 5, 24, 24, $label, $fg);
        imagestring($img, 3, 24, 50, 'modelizmclub stress '.date('H:i:s'), $fg);

        $base = tempnam(sys_get_temp_dir(), 'stress_');
        $path = $base.'.jpg';
        @unlink($base);
        imagejpeg($img, $path, 72);
        imagedestroy($img);

        return $path;
    }

    private function verifyPhotos(Http $http): void
    {
        $this->info('Проверка фото в хранилище (наличие + обработка)…');

        $allReadyWithDims = Media::query()
            ->whereIn('id', $this->mediaIds)
            ->where('status', 'ready')
            ->whereNotNull('width')->where('width', '>', 0)
            ->whereNotNull('height')->where('height', '>', 0)
            ->where('size_bytes', '>', 0)
            ->count();
        $this->line("  Медиа со статусом ready + размерами + dimensions: {$allReadyWithDims} / ".count($this->mediaIds));

        // Object-store existence on a random sample (one API call each).
        $sample = Media::query()->whereIn('id', $this->mediaIds)->inRandomOrder()->limit(min(60, count($this->mediaIds)))->get();
        foreach ($sample as $m) {
            $this->step('photo.read', 'read', function () use ($m): void {
                if (! Storage::disk($m->disk)->exists($m->path)) {
                    throw new \RuntimeException('нет файла в хранилище: '.$m->path);
                }
                $size = Storage::disk($m->disk)->size($m->path);
                if ($size <= 0) {
                    throw new \RuntimeException('пустой файл');
                }
            });
        }

        // End-to-end: fetch a few through the public media proxy over HTTP.
        $served = 0;
        $httpSample = $sample->take(5);
        foreach ($httpSample as $m) {
            try {
                $resp = $http->timeout(15)->get((string) $m->url);
                if ($resp->ok() && strlen($resp->body()) > 0) {
                    $served++;
                }
            } catch (\Throwable) {
                // best effort
            }
        }
        $this->line("  Отдано через медиа-прокси по HTTP: {$served} / ".$httpSample->count());
    }

    /** @param array<int, User> $created */
    private function proveEncryption(ChatService $chat, array $created, bool $runEncrypted): void
    {
        $this->info('Проверка возможности шифрования сообщений…');

        if (count($created) < 2) {
            $this->warn('  Недостаточно пользователей для проверки.');

            return;
        }

        // Force encryption for this proof regardless of run mode.
        $previous = config('chat.encrypt_messages', false);
        config(['chat.encrypt_messages' => true]);

        $a = $created[0];
        $b = $created[1];
        $plaintext = 'СЕКРЕТ-'.Str::random(20);

        $conversation = $chat->findOrCreateDirect($a, $b);
        $message = $chat->sendMessage($conversation, $a, $plaintext);

        $rawStored = DB::table('messages')->where('id', $message->id)->value('body');
        $decrypted = Message::query()->find($message->id)?->body;

        $isCipher = is_string($rawStored) && $rawStored !== $plaintext && ! str_contains($rawStored, $plaintext);
        $roundTrips = $decrypted === $plaintext;

        $this->table(['Проверка', 'Результат'], [
            ['В БД хранится шифротекст (не исходный текст)', $isCipher ? 'ДА ✓' : 'НЕТ ✗'],
            ['Расшифровка возвращает исходный текст', $roundTrips ? 'ДА ✓' : 'НЕТ ✗'],
            ['Образец шифротекста', Str::limit((string) $rawStored, 54)],
            ['Расшифрованный текст', (string) $decrypted],
        ]);

        // Clean up the probe message so it does not pollute the dialog.
        Message::query()->where('id', $message->id)->forceDelete();

        config(['chat.encrypt_messages' => $previous]);

        if ($runEncrypted) {
            $raw = DB::table('messages')->whereIn('user_id', $this->simUserIds())->latest('id')->value('body');
            $looks = is_string($raw) && $this->looksLikeCipher($raw);
            $this->line('  Прогон с --encrypt: образец реального сообщения в БД '.($looks ? 'зашифрован ✓' : 'НЕ зашифрован ✗'));
        }
    }

    private function looksLikeCipher(string $value): bool
    {
        $decoded = base64_decode($value, true);

        return is_string($decoded) && str_contains($decoded, '"mac"') && str_contains($decoded, '"iv"');
    }

    /**
     * @param  callable():mixed  $fn
     */
    private function step(string $action, string $type, callable $fn): mixed
    {
        $this->results[$action] ??= ['type' => $type, 'ok' => 0, 'fail' => 0, 'durs' => [], 'errors' => []];

        $start = microtime(true);
        try {
            $value = $fn();
            $this->results[$action]['durs'][] = (microtime(true) - $start) * 1000;
            $this->results[$action]['ok']++;

            return $value;
        } catch (\Throwable $e) {
            $this->results[$action]['durs'][] = (microtime(true) - $start) * 1000;
            $this->results[$action]['fail']++;
            if (count($this->results[$action]['errors']) < 3) {
                $this->results[$action]['errors'][] = $e->getMessage();
            }

            return null;
        }
    }

    private function renderStability(): void
    {
        $this->info('=== Стабильность операций (запись/чтение) ===');
        $rows = [];
        ksort($this->results);
        foreach ($this->results as $action => $r) {
            $durs = $r['durs'];
            $total = $r['ok'] + $r['fail'];
            $rate = $total > 0 ? round($r['ok'] / $total * 100, 1) : 0;
            $rows[] = [
                $action,
                $r['type'] === 'write' ? 'запись' : 'чтение',
                $total,
                $r['ok'],
                $r['fail'],
                $rate.'%',
                $durs ? round(array_sum($durs) / count($durs), 1) : 0,
                round($this->percentile($durs, 95), 1),
                $durs ? round(max($durs), 1) : 0,
            ];
        }
        $this->table(
            ['Операция', 'Тип', 'Всего', 'OK', 'Ошибки', 'Успех', 'avg ms', 'p95 ms', 'max ms'],
            $rows,
        );

        foreach ($this->results as $action => $r) {
            if ($r['fail'] > 0 && $r['errors']) {
                $this->warn("  {$action}: ".$r['errors'][0]);
            }
        }
    }

    private function renderStorage(bool $encrypt): void
    {
        $ids = $this->simUserIds();
        $listingIds = Listing::query()->whereIn('user_id', $ids)->pluck('id');
        $mediaQ = Media::query()->whereIn('uploaded_by', $ids);

        $stats = [
            ['Пользователи', User::query()->whereIn('id', $ids)->count()],
            ['Диалоги', (int) DB::table('conversation_participants')->whereIn('user_id', $ids)->distinct('conversation_id')->count('conversation_id')],
            ['Сообщения (хранится в БД)', Message::query()->whereIn('user_id', $ids)->count()],
            ['Объявления', Listing::query()->whereIn('user_id', $ids)->count()],
            ['Фото-медиа (Media)', (clone $mediaQ)->count()],
            ['Фото со статусом ready', (clone $mediaQ)->where('status', 'ready')->count()],
            ['Фото с размерами (обработаны)', (clone $mediaQ)->whereNotNull('width')->where('width', '>', 0)->count()],
            ['Суммарный объём фото, МБ', round((float) (clone $mediaQ)->sum('size_bytes') / 1048576, 2)],
            ['Связок listing↔media', DB::table('listing_media')->whereIn('listing_id', $listingIds)->count()],
            ['Шифрование сообщений в этом прогоне', $encrypt ? 'включено' : 'выключено (capability готова)'],
        ];

        $this->info('=== Хранение данных (факт в БД/хранилище) ===');
        $this->table(['Метрика', 'Значение'], $stats);
    }

    private function percentile(array $durs, float $p): float
    {
        if ($durs === []) {
            return 0.0;
        }
        sort($durs);
        $idx = (int) ceil($p / 100 * count($durs)) - 1;
        $idx = max(0, min($idx, count($durs) - 1));

        return $durs[$idx];
    }

    /** @return array<int,int> */
    private function simUserIds(): array
    {
        return User::query()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('id')->all();
    }

    private function cleanup(): void
    {
        $this->warn('Очистка предыдущих нагрузочных аккаунтов…');
        $ids = User::withTrashed()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('id')->all();
        if ($ids === []) {
            $this->line('Нечего очищать.');

            return;
        }

        $listingIds = Listing::query()->whereIn('user_id', $ids)->pluck('id')->all();
        $conversationIds = DB::table('conversation_participants')->whereIn('user_id', $ids)->pluck('conversation_id')->unique()->all();

        // Remove uploaded objects from storage first.
        if (! $this->option('keep-media')) {
            $deleted = 0;
            Media::query()->whereIn('uploaded_by', $ids)->orderBy('id')->chunk(200, function ($chunk) use (&$deleted): void {
                foreach ($chunk as $m) {
                    try {
                        if (Storage::disk($m->disk)->exists($m->path)) {
                            Storage::disk($m->disk)->delete($m->path);
                            $deleted++;
                        }
                    } catch (\Throwable) {
                        // tolerate storage hiccups
                    }
                }
            });
            $this->line("  Удалено объектов из хранилища: {$deleted}");
        }

        $this->safe(fn () => DB::table('listing_media')->whereIn('listing_id', $listingIds)->delete());
        $this->safe(fn () => Listing::query()->whereIn('id', $listingIds)->delete());

        $this->safe(fn () => Message::query()->whereIn('conversation_id', $conversationIds)->forceDelete());
        $this->safe(fn () => DB::table('conversation_participants')->whereIn('conversation_id', $conversationIds)->delete());
        $this->safe(fn () => Conversation::query()->whereIn('id', $conversationIds)->delete());

        $this->safe(fn () => Media::query()->whereIn('uploaded_by', $ids)->delete());
        $this->safe(fn () => DB::table('user_follows')->where(fn ($q) => $q->whereIn('follower_id', $ids)->orWhereIn('following_id', $ids))->delete());
        $this->safe(fn () => DB::table('user_friendships')->where(fn ($q) => $q->whereIn('user_id', $ids)->orWhereIn('friend_id', $ids))->delete());
        $this->safe(fn () => DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete());
        $this->safe(fn () => UserProfile::query()->whereIn('user_id', $ids)->delete());
        $this->safe(fn () => User::withTrashed()->whereIn('id', $ids)->forceDelete());

        $this->line('Очистка завершена ('.count($ids).' аккаунтов).');
    }

    private function safe(callable $fn): void
    {
        try {
            $fn();
        } catch (QueryException) {
            // tolerate optional schema differences
        }
    }
}
