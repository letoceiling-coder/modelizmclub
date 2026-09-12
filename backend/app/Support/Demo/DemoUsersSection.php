<?php

namespace App\Support\Demo;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\City;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Illuminate\Support\Str;
use Modules\Media\Services\MediaUploadService;

/**
 * Демо-люди: учётная запись, профиль, город, аватар, ступень доступа.
 *
 * ТЕЛЕФОНЫ ВЫДУМАНЫ. Номера идут одним блоком `+7 999 900 00 XX`. Смс им
 * никто не шлёт: подтверждение проставляется полем `phone_verified_at`, минуя
 * `PhoneVerificationService`, — то есть ни один код никуда не уходит. Блок
 * выбран так, чтобы не пересекаться с живыми учётками; если пересечение всё
 * же случится, уникальный индекс `users_phone_unique` остановит создание с
 * понятной ошибкой, а не тихо приклеит демо-номер к человеку.
 *
 * ПОДПИСКА ставится записью `user_subscriptions` со ссылкой на настоящий
 * тариф — без платежа. Денег в биллинге от этого не появляется: платёж и
 * подписка в этой системе разные сущности, и админ выдаёт подписку тем же
 * способом (`granted_by_admin_id`).
 *
 * ИДЕМПОТЕНТНОСТЬ. Человек ищется по адресу. Уже существующий пропускается
 * целиком — включая профиль и подписку, чтобы повторный прогон не переписывал
 * то, что могли поменять руками во время проверки.
 */
class DemoUsersSection extends DemoSection
{
    public function __construct(private readonly MediaUploadService $uploads) {}

    public function key(): string
    {
        return 'users';
    }

    public function title(): string
    {
        return 'Люди';
    }

    public function columns(): array
    {
        return ['состояние', 'сколько', 'уже есть'];
    }

    public function warnings(): array
    {
        $out = [];
        if (SubscriptionPlan::query()->count() === 0) {
            $out[] = 'нет ни одного тарифа — подписки выданы не будут';
        }
        if (User::query()->where('role', UserRole::Admin)->doesntExist()) {
            $out[] = 'нет учётной записи администратора — подписку выдавать некому, '.
                'а без `granted_by_admin_id` доступ подписчика не откроется';
        }

        return $out;
    }

    public function plan(): array
    {
        $have = array_keys($this->people());
        $rows = [];
        $create = 0;
        $exists = 0;

        foreach ($this->groups() as $label => $people) {
            $missing = array_values(array_filter($people, fn (array $p): bool => ! in_array($p['local'], $have, true)));
            $rows[] = [$label, count($people), count($people) - count($missing)];
            $create += count($missing);
            $exists += count($people) - count($missing);
        }

        return ['rows' => $rows, 'create' => $create, 'exists' => $exists];
    }

    public function create(callable $tick): int
    {
        $have = $this->people();
        $cityIds = City::query()->pluck('id', 'name')->all();
        $plan = SubscriptionPlan::query()->orderBy('sort_order')->first();
        $adminId = User::query()->where('role', UserRole::Admin)->orderBy('id')->value('id');
        $made = 0;

        foreach (DemoPeople::roster() as $index => $person) {
            if (isset($have[$person['local']])) {
                continue;
            }

            $user = $this->makeUser($person, $index);
            $this->makeProfile($user, $person, $cityIds);
            $this->grantSubscription($user, $person, $plan, $adminId === null ? null : (int) $adminId);

            $made++;
            $tick($person['name']);
        }

        return $made;
    }

    /** @return array<string, list<array{local: string, name: string, city: string, about: string, flags: list<string>}>> */
    private function groups(): array
    {
        $groups = [
            'с подпиской' => [],
            'подписка истекла' => [],
            'телефон подтверждён' => [],
            'без телефона' => [],
        ];

        foreach (DemoPeople::roster() as $person) {
            $flags = $person['flags'];
            if (in_array(DemoPeople::SUB_ACTIVE, $flags, true)) {
                $groups['с подпиской'][] = $person;
            } elseif (in_array(DemoPeople::SUB_EXPIRED, $flags, true)) {
                $groups['подписка истекла'][] = $person;
            } elseif (in_array(DemoPeople::PHONE, $flags, true)) {
                $groups['телефон подтверждён'][] = $person;
            } else {
                $groups['без телефона'][] = $person;
            }
        }

        return $groups;
    }

    /** @param array{local: string, name: string, city: string, about: string, flags: list<string>} $person */
    private function makeUser(array $person, int $index): User
    {
        $verified = in_array(DemoPeople::PHONE, $person['flags'], true)
            || in_array(DemoPeople::SUB_ACTIVE, $person['flags'], true)
            || in_array(DemoPeople::SUB_EXPIRED, $person['flags'], true);

        return User::create([
            'name' => $person['name'],
            'email' => $person['local'].'@'.self::EMAIL_DOMAIN,
            // Пароль случайный и нигде не печатается: входить в демо-учётки
            // не нужно, а известный пароль на проде — дыра.
            'password' => Str::random(40),
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'registration_track' => RegistrationTrack::Listing,
            'email_verified_at' => now(),
            'phone' => $verified ? sprintf('+79999000%03d', $index + 1) : null,
            'phone_verified_at' => $verified ? now()->subDays(30 - ($index % 30)) : null,
        ]);
    }

    /** @param array<string, int> $cityIds */
    private function makeProfile(User $user, array $person, array $cityIds): void
    {
        $avatar = $this->image($user, $this->uploads, $person['name'], 'avatar');

        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $person['name'].' (демо)',
            'slug' => $this->uniqueSlug($person['local']),
            'avatar_media_id' => $avatar->id,
            'city_id' => $cityIds[$person['city']] ?? null,
            'bio' => self::MARKER.' '.$person['about'],
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
    }

    /**
     * Подписка как её выдаёт админка, а не как кажется.
     *
     * ДВЕ ЛОВУШКИ, обе стоили бы демо-набора, который выглядит правильно и не
     * работает.
     *
     * Первая: `granted_by_admin_id` обязателен. `hasActiveSubscription()`
     * считает доступ по трём основаниям — оплата, промо «первая сотня» и
     * ручная выдача, — и ручная узнаётся ровно по этому полю. Строка без него
     * даёт `is_active: true` в ответе и закрытый доступ на деле; в коде
     * `User::hasAdminGrantedSubscription()` об этом прямо написано.
     *
     * Вторая: истёкшей подписки как статуса в базе нет. `UserResource` считает
     * «истекла» по дате, а `status` остаётся `active`. Поэтому истёкшая здесь
     * — та же строка с прошедшим `ends_at`, а не выдуманное значение
     * `expired`, которого никто не пишет и никто не ждёт.
     */
    private function grantSubscription(User $user, array $person, ?SubscriptionPlan $plan, ?int $adminId): void
    {
        if ($plan === null || $adminId === null) {
            return;
        }

        $active = in_array(DemoPeople::SUB_ACTIVE, $person['flags'], true);
        $expired = in_array(DemoPeople::SUB_EXPIRED, $person['flags'], true);
        if (! $active && ! $expired) {
            return;
        }

        UserSubscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'granted_by_admin_id' => $adminId,
            'status' => 'active',
            'starts_at' => $active ? now()->subMonth() : now()->subMonths(13),
            'ends_at' => $active ? now()->addMonths(11) : now()->subMonth(),
            'auto_renew' => false,
        ]);
    }

    private function uniqueSlug(string $base): string
    {
        $slug = Str::slug($base) ?: 'demo-user';
        $candidate = $slug;
        $suffix = 1;
        while (UserProfile::query()->where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.$suffix++;
        }

        return $candidate;
    }
}
