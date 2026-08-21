<?php

namespace App\Http\Middleware;

use App\Support\FeatureFlags;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EnsureCommunitiesEnabled
{
    public function handle(Request $request, Closure $next): mixed
    {
        if (! FeatureFlags::enabled('feature.communities_enabled')) {
            throw new NotFoundHttpException('Сообщества отключены.');
        }

        return $next($request);
    }
}
