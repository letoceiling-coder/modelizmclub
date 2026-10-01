<?php

namespace Modules\Auth\Http\Resources;

use App\Models\PendingEmailChange;
use App\Support\AdminAccess;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\PostCategoryResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'email' => $this->displayEmail(),
            'name' => $this->name,
            'role' => $this->role?->value ?? $this->role,
            'status' => $this->status?->value ?? $this->status,
            'registration_track' => $this->registration_track?->value,
            'locale' => $this->locale,
            'theme_preference' => $this->theme_preference,
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'email_verified' => ! $this->requiresEmailVerification(),
            /*
             * Незавершённая смена адреса. Смена в два шага: `change-email`
             * кладёт строку в `pending_email_changes` и шлёт код на новый
             * адрес, `confirm-email` его подтверждает. До 12.09 наружу это не
             * отдавалось, и после перезагрузки страница настроек не знала, что
             * смена начата: показывала прежний адрес, а пользователь считал,
             * что уже сменил.
             *
             * Только себе: ресурс общий с админским списком пользователей, и
             * чужой ожидающий адрес там не нужен. `when` заодно не даёт запросу
             * выполниться на каждой строке списка.
             */
            'pending_email' => $this->when(
                $request->user()?->id === $this->id,
                fn () => PendingEmailChange::query()
                    ->where('user_id', $this->id)
                    ->where('expires_at', '>', now())
                    ->value('new_email'),
            ),
            /*
             * Есть ли человеку куда войти в админке — по той же карте,
             * что охраняет маршруты (App\Support\AdminAccess).
             *
             * До 01.10 пункт «Админ-панель» в меню аватара показывался по
             * `u.role === "owner"`, посчитанному в браузере. Модератор и
             * администратор направления входа не видели, хотя разделы им
             * открыты, — и попадали в админку только по прямой ссылке.
             *
             * Считается непустотой списка разделов, а не ролью: у кого
             * разделов ноль, тому ссылка привела бы в 403.
             *
             * Только самому себе: ресурс общий с админским списком
             * пользователей, где строк полсотни, а `sectionsFor` ходит в
             * таблицу выданных прав. `when` не даёт запросу выполниться
             * на каждой строке — так же сделано с `pending_email` выше.
             */
            'can_open_admin' => $this->when(
                $this->aboutSelf($request),
                fn () => AdminAccess::sectionsFor($this->resource) !== [],
            ),
            'oauth_providers' => $this->oauthProviderNames(),
            'phone' => $this->phone,
            'phone_verified_at' => $this->phone_verified_at?->toIso8601String(),
            'phone_verified' => $this->phone_verified_at !== null,
            'is_first_hundred' => (bool) $this->is_first_hundred,
            'listing_placement_credits' => (int) ($this->listing_placement_credits ?? 0),
            // Льготы на человека (RolePrivileges): ресурс отдаётся только
            // самому человеку и в админке.
            'subscription_exempt' => (bool) $this->subscription_exempt,
            'free_listings_quota' => (int) ($this->free_listings_quota ?? 0),
            'free_listings_unlimited' => (bool) $this->free_listings_unlimited,
            'free_listings_used' => (int) ($this->free_listings_used ?? 0),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'profile' => $this->whenLoaded('profile', function () {
                $profile = $this->profile;

                return [
                    'display_name' => $profile->display_name,
                    'slug' => $profile->slug,
                    'bio' => $profile->bio,
                    'city_id' => $profile->city_id,
                    'vk_url' => $profile->vk_url,
                    'telegram_url' => $profile->telegram_url,
                    'website_url' => $profile->website_url,
                    'city' => $profile->relationLoaded('city') && $profile->city ? [
                        'id' => $profile->city->id,
                        'name' => $profile->city->name,
                        'slug' => $profile->city->slug,
                    ] : null,
                    'avatar' => $profile->relationLoaded('avatar') && $profile->avatar ? [
                        'uuid' => $profile->avatar->uuid,
                        'url' => $profile->avatar->url ?? null,
                    ] : null,
                    'cover' => $profile->relationLoaded('cover') && $profile->cover ? [
                        'uuid' => $profile->cover->uuid,
                        'url' => $profile->cover->url ?? null,
                    ] : null,
                ];
            }),
            'interests' => PostCategoryResource::collection($this->whenLoaded('interests')),
            'subscription' => $this->when($this->relationLoaded('subscriptions'), fn () => $this->subscriptionSummary()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Ответ о самом человеке, а не о третьем лице.
     *
     * Пока условием стояло `$request->user()?->id === $this->id`, поле
     * терялось на входе: `/auth/login` отдаёт ресурс до аутентификации,
     * `$request->user()` там null, и сразу после входа владелец с
     * модератором пункта «Админ-панель» не видели. Появлялся он только
     * после того, как фоновая загрузка `/auth/me` перезапишет снимок, —
     * то есть «иногда и не сразу». Найдено ревью 01.10.
     *
     * Поэтому опознание явное, а не выведенное из наличия токена:
     * маршруты, которые отдают ресурс о только что вошедшем, помечают
     * его сами. Обратное — молчаливое «нет пользователя, значит это он» —
     * открыло бы поле любому будущему маршруту без аутентификации,
     * который вернёт чужую строку.
     */
    private bool $aboutSelf = false;

    /** Пометить ответ как «о самом себе» — см. `aboutSelf`. */
    public function asSelf(): static
    {
        $this->aboutSelf = true;

        return $this;
    }

    private function aboutSelf(Request $request): bool
    {
        return $this->aboutSelf || $request->user()?->id === $this->id;
    }

    /** Latest subscription row, flattened for the admin user list. */
    private function subscriptionSummary(): ?array
    {
        $sub = $this->subscriptions->sortByDesc('ends_at')->sortByDesc('id')->first();
        if (! $sub) {
            return null;
        }

        $active = $sub->status === 'active' && ($sub->ends_at === null || $sub->ends_at->isFuture());
        $expired = $sub->status === 'active' && $sub->ends_at !== null && $sub->ends_at->isPast();

        return [
            'status' => $expired ? 'expired' : ($active ? 'active' : $sub->status),
            'is_active' => $active,
            'ends_at' => $sub->ends_at?->toIso8601String(),
            'auto_renew' => (bool) $sub->auto_renew,
        ];
    }
}
