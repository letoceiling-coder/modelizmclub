<?php

namespace App\Http\Middleware;

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

        if (! $user->hasSubscriptionAccess()) {
            return response()->json([
                'message' => 'Оформите подписку, чтобы смотреть обзоры.',
                'code' => 'subscription_required',
            ], 403);
        }

        return $next($request);
    }
}
