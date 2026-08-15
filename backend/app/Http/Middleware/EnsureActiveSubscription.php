<?php

namespace App\Http\Middleware;

use App\Models\UserSubscription;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('sanctum')->user();

        if (! $user) {
            return response()->json([
                'message' => 'Оформите подписку, чтобы смотреть обзоры.',
                'code' => 'subscription_required',
            ], 403);
        }

        if ($user->isModerator()) {
            return $next($request);
        }

        $active = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->exists();

        if (! $active) {
            return response()->json([
                'message' => 'Оформите подписку, чтобы смотреть обзоры.',
                'code' => 'subscription_required',
            ], 403);
        }

        return $next($request);
    }
}
