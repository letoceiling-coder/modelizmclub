<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Optional authentication: resolves the Sanctum user when a valid bearer token
 * is present, but never rejects guests. Used on public read endpoints that
 * still personalize output for signed-in users (spec v4.0 §1.3 open viewing).
 */
class ResolveOptionalUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('sanctum')->user();

        if ($user) {
            $request->setUserResolver(fn () => $user);
        }

        return $next($request);
    }
}
