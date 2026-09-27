<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Всё про одного человека одним запросом — для карточки в админке.
 *
 * ЗАЧЕМ РУЧКА, А НЕ СБОРКА НА ФРОНТЕ. Карточка показывает десяток величин из
 * восьми таблиц. Собирать её из восьми запросов значило бы открывать окно
 * восемь раз по кругу и видеть, как числа доезжают по одному; при отказе
 * одного из восьми — карточку, наполовину пустую без объяснения.
 *
 * ЧТО СЧИТАЕТСЯ, А ЧТО НЕТ. Числа берутся отдельными `count`, а не
 * `withCount` на одном построителе: связей нет у половины (объявления и
 * записи лежат в своих таблицах, сообщества — по `created_by`, каналы — по
 * `owner_id`), и одним запросом это превратилось бы в шесть присоединений
 * ради шести чисел.
 *
 * ДЕНЬГИ — ТОЛЬКО ВЛАДЕЛЬЦУ. Раздел `users` открыт модератору, и список
 * пользователей он видит вместе с адресом и телефоном — так было до этой
 * правки. Кошелёк и журнал начислений закрыты: в этом коде деньги вообще
 * доступны только Владельцу (`users.manage`), и карточка это правило не
 * ослабляет. Модератору поля не приходят вовсе, а не приходят нулями.
 */
#[Group('Admin — Users', weight: 30)]
class AdminUserCardController extends Controller
{
    /** Сколько последних действий из журнала показывать. */
    private const ДЕЙСТВИЙ = 20;

    #[Endpoint(
        title: 'Карточка пользователя',
        description: 'Всё про одного человека для окна в админке: профиль, счётчики, пространства, последние действия.',
    )]
    #[PathParameter('uuid', description: 'UUID пользователя')]
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $user = User::query()
            ->with(['profile.city', 'profile.avatar', 'subscriptions'])
            ->where('uuid', $uuid)
            ->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        $владелец = $request->user()?->isOwner() ?? false;

        $data = [
            'uuid' => $user->uuid,
            'name' => $user->name,
            'display_name' => $user->profile?->display_name ?? $user->name,
            'slug' => $user->profile?->slug,
            'avatar_url' => $user->profile?->avatar?->url,
            'email' => $user->email,
            'phone' => $user->phone,
            'phone_verified' => $user->phone_verified_at !== null,
            'email_verified' => $user->email_verified_at !== null,
            'city' => $user->profile?->city?->name,
            'role' => $user->role?->value ?? $user->role,
            'status' => $user->status?->value ?? $user->status,
            'registered_at' => $user->created_at?->toIso8601String(),
            'last_seen_at' => $user->last_seen_at?->toIso8601String(),
            'subscription' => $this->подписка($user),
            'placements' => $this->размещения($user),
            'counts' => $this->счётчики($user),
            'spaces' => $this->пространства($user),
            'audit' => $this->журнал($user),
        ];

        if ($владелец) {
            $data['wallet'] = $this->кошелёк($user);
            $data['placement_grants'] = $this->начисления($user);
        }

        return response()->json(['data' => $data]);
    }

    /** @return array<string, mixed>|null */
    private function подписка(User $user): ?array
    {
        $sub = $user->subscriptions->sortByDesc('ends_at')->sortByDesc('id')->first();
        if (! $sub) {
            return null;
        }

        $активна = $sub->status === 'active' && ($sub->ends_at === null || $sub->ends_at->isFuture());
        $истекла = $sub->status === 'active' && $sub->ends_at !== null && $sub->ends_at->isPast();

        return [
            'status' => $истекла ? 'expired' : ($активна ? 'active' : $sub->status),
            'is_active' => $активна,
            'ends_at' => $sub->ends_at?->toIso8601String(),
            'auto_renew' => (bool) $sub->auto_renew,
        ];
    }

    /**
     * Три разных способа разместить объявление бесплатно — рядом.
     *
     * Их путали, и не зря: числа похожие, а устроены по-разному.
     *
     *   личная квота     льгота на человека, может быть без предела
     *   квота подписки   столько-то в месяц, каждый месяц заново
     *   запас размещений `listing_placement_credits` — штуки, не сгорают
     *
     * Запас — не «лимит бесплатных размещений», как читается из старого
     * названия «кредиты размещения». Это остаток штук, и часть его человек
     * **оплатил**: оплата размещения, не привязавшаяся к объявлению,
     * превращается в штуку на следующее (`PaymentFulfillmentService`).
     * Остальное — награда за приглашённого друга и начисление из админки.
     *
     * @return array<string, mixed>
     */
    private function размещения(User $user): array
    {
        $личная = $user->personalFreeListingsRemaining();

        return [
            'stock' => (int) ($user->listing_placement_credits ?? 0),
            'personal_quota_remaining' => $личная,
            'personal_quota_unlimited' => $личная === null,
            'subscription_exempt' => (bool) $user->subscription_exempt,
        ];
    }

    /** @return array<string, int> */
    private function счётчики(User $user): array
    {
        return [
            'listings' => (int) DB::table('listings')
                ->where('user_id', $user->id)
                ->whereNull('deleted_at')
                ->count(),
            'posts' => (int) DB::table('posts')->where('user_id', $user->id)->count(),
            'comments' => (int) DB::table('comments')->where('user_id', $user->id)->count(),
            'safe_deals' => (int) DB::table('safe_deals')
                ->where(fn ($q) => $q->where('buyer_id', $user->id)->orWhere('seller_id', $user->id))
                ->count(),
        ];
    }

    /**
     * Сообщества и каналы — и созданные, и те, где человек просто участник.
     *
     * Разделено нарочно: «создал» и «вступил» — разные разговоры. До этой
     * карточки в админке не было видно ни того, ни другого, и на вопрос
     * «что мы потеряем, если удалим учётку» приходилось смотреть в базу.
     *
     * @return array<string, mixed>
     */
    private function пространства(User $user): array
    {
        $имена = fn (string $table, string $column, array $ids) => DB::table($table)
            ->whereIn('id', $ids)
            ->pluck('name', 'id')
            ->map(fn ($n) => (string) $n)
            ->values()
            ->all();

        $созданныеСообщества = DB::table('communities')
            ->where('created_by', $user->id)
            ->whereNull('deleted_at')
            ->pluck('id')->all();
        $участиеСообщества = DB::table('community_members')
            ->where('user_id', $user->id)
            ->pluck('community_id')->all();
        $своиКаналы = DB::table('channels')->where('owner_id', $user->id)->pluck('id')->all();
        $подпискиКаналы = DB::table('channel_subscriptions')
            ->where('user_id', $user->id)
            ->pluck('channel_id')->all();

        return [
            'communities_created' => $имена('communities', 'name', $созданныеСообщества),
            'communities_joined' => count(array_diff($участиеСообщества, $созданныеСообщества)),
            'channels_owned' => $имена('channels', 'name', $своиКаналы),
            'channels_subscribed' => count(array_diff($подпискиКаналы, $своиКаналы)),
        ];
    }

    /** @return array<string, mixed> */
    private function кошелёк(User $user): array
    {
        $wallet = DB::table('wallets')->where('user_id', $user->id)->first();

        return [
            'balance_kopecks' => (int) ($wallet->balance_kopecks ?? 0),
            'held_kopecks' => (int) ($wallet->held_kopecks ?? 0),
        ];
    }

    /**
     * Журнал начислений запаса размещений.
     *
     * В `bonus_accounts.balance` смотреть незачем: его никто не увеличивает,
     * он всегда ноль — проверено поиском по коду, единственные записи в эту
     * таблицу создают строку со `balance => 0`. Живёт только журнал
     * `bonus_transactions`, и в нём лежат именно штуки размещений: и награда
     * за друга (`referral`), и выдача из админки (`admin_grant`). Показывать
     * «Бонусы: 0» было бы хуже, чем не показывать: выглядит как «у человека
     * бонусов нет», а верно — «бонусов нет в системе».
     *
     * @return list<array<string, mixed>>
     */
    private function начисления(User $user): array
    {
        return DB::table('bonus_transactions')
            ->where('account_user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(self::ДЕЙСТВИЙ)
            ->get(['amount', 'type', 'description', 'created_at'])
            ->map(fn ($row) => [
                'amount' => (int) $row->amount,
                'type' => (string) $row->type,
                'description' => $row->description,
                'created_at' => $row->created_at,
            ])
            ->all();
    }

    /**
     * Последние действия из журнала изменений — про этого человека.
     *
     * Именно про него, а не им совершённые: карточку открывают, чтобы
     * понять, что с учёткой делали. `auditable_id` ловит записи, где он
     * предмет действия; кто действовал — в `user`.
     *
     * Своё имя приходится подставлять вручную: `auditable` полиморфный, и
     * `with` по нему подтянул бы модели всех типов, а нужен только User.
     *
     * @return list<array<string, mixed>>
     */
    private function журнал(User $user): array
    {
        return AuditLog::query()
            ->with('user.profile')
            ->where('auditable_type', User::class)
            ->where('auditable_id', $user->id)
            ->latest('created_at')
            ->limit(self::ДЕЙСТВИЙ)
            ->get()
            ->map(fn (AuditLog $log) => [
                'action' => $log->action,
                'by' => $log->user?->profile?->display_name ?? $log->user?->name,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();
    }
}
