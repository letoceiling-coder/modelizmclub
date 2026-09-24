<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Services\AuditService;
use Throwable;

/**
 * Обезличить учётную запись, не удаляя её.
 *
 * Почему не удаление. У `safe_deals`, `wallets` и `wallet_transactions`
 * внешние ключи на `users` объявлены `CASCADE`: удаление учётки 25.09
 * снесло бы 28 сделок, 32 проводки и обе записи обнуления кошельков,
 * сделанные часом раньше. То есть операция «обнулить, но не сносить
 * проводки» была бы отменена следующим же шагом.
 *
 * Обезличивание решает обе задачи сразу: учётка перестаёт быть рабочей —
 * заблокирована, без почты, без телефона, без токенов, — а бухгалтерия
 * и аудит остаются сводимыми.
 *
 * Что затирается: почта, имя и пароль в `users`; **публичное имя, ссылка,
 * аватар, обложка, описание и ссылки на соцсети в `user_profiles`**;
 * телефон и его подтверждение; все токены доступа; привязки OAuth вместе
 * с их токенами.
 *
 * Про профиль отдельно: рядом с объявлениями и сделками показывается
 * `user_profiles.display_name`, а не `users.name` — в бэкенде 31 место
 * читает именно его. Первая версия команды трогала только `users`, и
 * «обезличенная» учётка продолжала бы показывать своё имя под каждой
 * оставшейся сделкой. Нашло ревью 25.09.
 *
 * Что остаётся: id, проводки, сделки, отправления, записи аудита.
 */
class AnonymizeUsersCommand extends Command
{
    protected $signature = 'users:anonymize
        {users* : id учётных записей через пробел}
        {--actor= : id того, от чьего имени пишется аудит}
        {--reason= : причина, попадёт в аудит}
        {--dry-run : показать, что будет сделано, ничего не меняя}';

    protected $description = 'Обезличить учётные записи: заблокировать, затереть личные поля, отозвать токены';

    public function handle(AuditService $audit): int
    {
        $dry = (bool) $this->option('dry-run');
        $reason = (string) ($this->option('reason') ?: 'Обезличивание учётной записи приёмки');

        $actor = null;
        if ($this->option('actor')) {
            $actor = User::query()->find((int) $this->option('actor'));
            if ($actor === null) {
                $this->error('Учётка для аудита не найдена: '.$this->option('actor'));

                return self::FAILURE;
            }
        }

        /*
         * Сначала проверяем весь список, только потом правим.
         *
         * До этого каждый id правился в своей транзакции, и отказ на третьем
         * оставлял первые два уже обезличенными — при том что команда
         * возвращала FAILURE. Для `users:anonymize 1228 1229 1230` это
         * означало бы необратимую половину работы под видом неудачи.
         * Нашло ревью 25.09.
         */
        $люди = [];
        foreach ($this->argument('users') as $raw) {
            $user = User::query()->find((int) $raw);
            if ($user === null) {
                $this->error('Нет учётки '.$raw.' — не трогаю никого');

                return self::FAILURE;
            }

            if ($user->role !== UserRole::User) {
                // Сотрудника обезличивать нельзя молча: у него права, и
                // «заблокированный владелец» — состояние, которого никто
                // не ждёт. Сначала снять роль, потом обезличивать.
                $this->error(sprintf('%d (%s): роль %s — сначала снимите роль, не трогаю никого', $user->id, $user->email, $user->role->value));

                return self::FAILURE;
            }

            $люди[] = $user;
        }

        $тронуто = 0;

        foreach ($люди as $user) {
            $было = [
                'email' => $user->email,
                'name' => $user->name,
                'status' => $user->status->value,
                'phone' => $user->phone,
                'токенов' => $user->tokens()->count(),
            ];

            $стало = [
                'email' => sprintf('anonymized-%d@removed.invalid', $user->id),
                'name' => 'Удалённая учётная запись',
                'status' => UserStatus::Blocked->value,
                'phone' => null,
                'токенов' => 0,
            ];

            $this->line(sprintf('  %d: %s «%s» → %s «%s», токенов %d → 0',
                $user->id, $было['email'], $было['name'], $стало['email'], $стало['name'], $было['токенов']));

            $тронуто++;

            if ($dry) {
                continue;
            }

            try {
                DB::transaction(function () use ($user, $стало, $actor, $audit, $было, $reason): void {
                    $user->tokens()->delete();

                    // Привязки соцсетей вместе с их токенами: вход через них
                    // `OAuthService` заблокированному откажет, но сам токен
                    // стороннего сервиса лежал бы в базе и дальше.
                    DB::table('user_oauth_accounts')->where('user_id', $user->id)->delete();

                    // Публичное имя, ссылка и всё, по чему человека узнают
                    // рядом с его объявлениями.
                    DB::table('user_profiles')->where('user_id', $user->id)->update([
                        'display_name' => 'Удалённая учётная запись',
                        'slug' => 'removed-'.$user->id,
                        'avatar_media_id' => null,
                        'cover_media_id' => null,
                        'bio' => null,
                        'vk_url' => null,
                        'telegram_url' => null,
                        'website_url' => null,
                    ]);
                    $user->forceFill([
                        'email' => $стало['email'],
                        'name' => $стало['name'],
                        'status' => UserStatus::Blocked,
                        'phone' => null,
                        'phone_verified_at' => null,
                        'email_verified_at' => null,
                        // Пароль заменяем на случайный: учётка не должна
                        // открываться прежним, если он где-то записан.
                        'password' => bcrypt(bin2hex(random_bytes(24))),
                    ])->save();

                    $audit->log($actor, 'admin.users.anonymized', $user, $было, $стало + ['причина' => $reason]);
                });
            } catch (Throwable $e) {
                $this->error(sprintf('%d: не вышло — %s', $user->id, $e->getMessage()));

                return self::FAILURE;
            }
        }

        $this->info(sprintf('%s учёток: %d', $dry ? 'Сухой прогон. Затронуло бы' : 'Обезличено', $тронуто));

        return self::SUCCESS;
    }
}
