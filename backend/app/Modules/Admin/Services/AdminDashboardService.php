<?php

namespace Modules\Admin\Services;

use App\Models\Banner;
use App\Models\Community;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\Promocode;
use App\Models\Report;
use App\Models\SubscriptionPlan;
use App\Models\User;

class AdminDashboardService
{
    public function stats(): array
    {
        return [
            'users_total' => User::query()->count(),
            'posts_total' => Post::query()->count(),
            'communities_total' => Community::query()->count(),
            'moderation_pending' => ModerationQueue::query()->where('status', 'pending')->count(),
            'reports_pending' => Report::query()->where('status', 'pending')->count(),
            'plans_active' => SubscriptionPlan::query()->where('is_active', true)->count(),
            'promocodes_active' => Promocode::query()->where('is_active', true)->count(),
            'banners_active' => Banner::query()->where('is_active', true)->count(),
        ];
    }
}
