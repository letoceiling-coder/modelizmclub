<?php

namespace App\Http\Middleware;

use App\Support\AdminAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Пускает в раздел админки по карте AdminAccess. */
class EnsureAdminSection
{
    public function handle(Request $request, Closure $next, string $section): Response
    {
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if (! AdminAccess::allows($user, $section)) {
            return response()->json(['message' => 'Нет доступа к этому разделу админки.'], 403);
        }

        return $next($request);
    }
}
