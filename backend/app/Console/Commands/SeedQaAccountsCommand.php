<?php

namespace App\Console\Commands;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Завести учётные записи приёмки в трёх состояниях доступа.
 *
 * Состояния ровно те, под которыми идёт дымовой прогон: без
 * подтверждённого телефона, с подтверждённым, с подпиской. Четвёртое —
 * гость — учётки не требует.
 *
 * Почты на своём домене, а не одноразовые: прежние были на `hebase.com`,
 * и письмо на такой адрес никуда не придёт, а значит и восстановление
 * доступа по почте не проверить.
 *
 * Каждая помечается `is_qa_account`. Признак отдельный от имени: имя
 * затирается обезличиванием, а по нему их и опознавали до 25.09 — после
 * чего опознать стало нечем.
 */
class SeedQaAccountsCommand extends Command
{
    protected $signature = 'qa:seed-accounts
        {--domain=qa.modelizmclub.ru : домен для адресов}
        {--dry-run : показать, что будет сделано, ничего не меняя}';

    protected $description = 'Завести учётки приёмки: без SMS, с SMS, с подпиской';

    /** @var list<array{ключ: string, адрес: string, имя: string, телефон: bool, подписка: bool}> */
    private const СОСТОЯНИЯ = [
        ['ключ' => 'registered', 'адрес' => 'qa-registered', 'имя' => 'Приёмка · без SMS', 'телефон' => false, 'подписка' => false],
        ['ключ' => 'verified', 'адрес' => 'qa-verified', 'имя' => 'Приёмка · с SMS', 'телефон' => true, 'подписка' => false],
        ['ключ' => 'subscriber', 'адрес' => 'qa-subscriber', 'имя' => 'Приёмка · с подпиской', 'телефон' => true, 'подписка' => true],
    ];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $domain = (string) $this->option('domain');
        $итог = [];

        foreach (self::СОСТОЯНИЯ as $i => $спец) {
            $email = $спец['адрес'].'@'.$domain;
            $есть = User::query()->where('email', $email)->first();

            if ($есть !== null) {
                $this->line(sprintf('  %s: уже есть (id %d) — выдаю новый токен', $спец['ключ'], $есть->id));
                if (! $dry) {
                    $итог[$спец['ключ']] = $this->токен($есть);
                }

                continue;
            }

            $this->line(sprintf('  %s: создаю %s «%s»%s', $спец['ключ'], $email, $спец['имя'],
                $спец['подписка'] ? ', с подпиской' : ($спец['телефон'] ? ', телефон подтверждён' : '')));

            if ($dry) {
                continue;
            }

            $user = DB::transaction(function () use ($спец, $email, $i): User {
                $user = User::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'name' => $спец['имя'],
                    'email' => $email,
                    // Телефон из диапазона, отведённого под вымышленные
                    // номера: настоящему человеку такой не принадлежит.
                    'phone' => sprintf('+7999000%04d', 1000 + $i),
                    'password' => bcrypt(Str::random(32)),
                    'role' => UserRole::User,
                    'status' => UserStatus::Active,
                    'is_qa_account' => true,
                    'registration_track' => RegistrationTrack::Listing,
                    'email_verified_at' => now(),
                    'phone_verified_at' => $спец['телефон'] ? now() : null,
                ]);

                UserProfile::query()->create([
                    'user_id' => $user->id,
                    'display_name' => $спец['имя'],
                    'slug' => $спец['адрес'].'-'.$user->id,
                    'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
                ]);

                if ($спец['подписка']) {
                    $this->подписка($user);
                }

                return $user;
            });

            $итог[$спец['ключ']] = $this->токен($user);
            $this->info(sprintf('    id %d', $user->id));
        }

        if ($dry) {
            $this->info('Сухой прогон: ничего не создано.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->line('Токены — положите в ~/.config/modelizmclub/qa-tokens.json:');
        foreach ($итог as $ключ => $токен) {
            $this->line(sprintf('  "%s": "%s",', $ключ, $токен));
        }

        return self::SUCCESS;
    }

    private function токен(User $user): string
    {
        // Прежние токены отзываем: иначе у одной учётки их копятся десятки,
        // и понять, какой из них в ходу, нельзя.
        $user->tokens()->delete();

        return $user->createToken('qa')->plainTextToken;
    }

    private function подписка(User $user): void
    {
        $plan = DB::table('subscription_plans')->orderBy('sort_order')->first();

        if ($plan === null) {
            // `plan_id` объявлен not null. Без тарифа вставка падает
            // ошибкой драйвера, по которой не понять, что делать. Скажем
            // словами: тарифы заводятся сидером, а не этой командой.
            throw new \RuntimeException(
                'Нет ни одного тарифа подписки — сначала `php artisan db:seed --class=SubscriptionPlanSeeder`.',
            );
        }

        DB::table('user_subscriptions')->insert([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
            'auto_renew' => false,
            // Отметка о выдаче: без неё `hasActiveSubscription()` такую
            // строку не признаёт — она выглядит как неоплаченная.
            'granted_by_admin_id' => $user->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
