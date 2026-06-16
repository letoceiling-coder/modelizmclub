<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    /** @param  list<string>  $roles */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (count($roles) === 1 && str_contains($roles[0], ',')) {
            $roles = array_map(trim(...), explode(',', $roles[0]));
        }

        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $allowed = array_map(
            fn (string $role) => UserRole::from($role),
            $roles,
        );

        if (! in_array($user->role, $allowed, true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
