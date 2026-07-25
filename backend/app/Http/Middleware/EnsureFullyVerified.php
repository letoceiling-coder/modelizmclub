<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFullyVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->email_verified_at) {
            return response()->json([
                'message' => 'Подтвердите email, чтобы выполнить это действие.',
                'code' => 'email_not_verified',
            ], 403);
        }

        if (! $user->phone_verified_at) {
            return response()->json([
                'message' => 'Подтвердите номер телефона по SMS, чтобы выполнить это действие.',
                'code' => 'phone_not_verified',
            ], 403);
        }

        return $next($request);
    }
}
