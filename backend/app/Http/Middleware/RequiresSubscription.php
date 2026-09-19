<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\PublicContent\Services\FeedGuestAccessService;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate write-actions behind an active subscription (spec v4.0 §1.3).
 *
 * Viewing content (reviews, landing, catalog) stays open; publishing content,
 * messaging and calls require a subscription. Moderators/admins bypass.
 *
 * С ключом действия (`requiresSubscription:feed.compose.open`) подписка
 * нужна, только если в карте доступа у этого действия уровень
 * `subscription`. Карту правят в админке, и по ней же закрывает кнопки
 * интерфейс; без ключа сервер жил своей жизнью: 19.09 учётка без подписки
 * создала и опубликовала запись прямым запросом, хотя «Что у вас нового?»
 * у неё было закрыто окном подписки. Без ключа — прежнее безусловное
 * правило (видео).
 *
 * Где карта применяется на сервере: `feed.compose.open` — создание,
 * публикация и отложенная публикация записи (лента и стена сообщества),
 * `feed.post.repost` — репост (app/Modules/Feed/routes/api.php);
 * `community.join` — вступление и заявка в сообщество; `channel.subscribe`
 * и `channel.post.create` — подписка на канал и запись в нём;
 * `call.start` — начало звонка и приглашение в групповой (с 19.09).
 * Отложенную запись планировщик сверяет с картой ещё раз в момент выхода —
 * см. PostService::publishDueScheduledPosts.
 */
class RequiresSubscription
{
    public function __construct(private readonly FeedGuestAccessService $access) {}

    public function handle(Request $request, Closure $next, ?string $action = null): Response
    {
        $user = Auth::guard('sanctum')->user() ?? $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Требуется авторизация.',
                'code' => 'unauthenticated',
            ], 401);
        }

        $satisfied = $action !== null
            ? $this->access->subscriptionSatisfied($user, $action)
            : $user->isModerator() || $user->hasActiveSubscription();

        if (! $satisfied) {
            return response()->json([
                'message' => 'Оформите подписку, чтобы публиковать контент и пользоваться этой функцией.',
                'code' => 'subscription_required',
            ], 403);
        }

        return $next($request);
    }
}
