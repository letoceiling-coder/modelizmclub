<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate write-actions behind an active subscription (spec v4.0 §1.3).
 *
 * Viewing content (reviews, landing, catalog) stays open; publishing content,
 * messaging and calls require a subscription. Moderators/admins bypass.
 */
class RequiresSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('sanctum')->user() ?? $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Требуется авторизация.',
                'code' => 'unauthenticated',
            ], 401);
        }

        if ($user->isModerator()) {
            return $next($request);
        }

        if (! $user->hasActiveSubscription()) {
            return response()->json([
                'message' => 'Оформите подписку, чтобы публиковать контент и пользоваться этой функцией.',
                'code' => 'subscription_required',
            ], 403);
        }

        return $next($request);
    }
}
