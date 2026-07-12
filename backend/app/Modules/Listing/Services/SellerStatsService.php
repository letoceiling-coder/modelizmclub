<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingViewDaily;
use App\Models\User;
use Illuminate\Support\Carbon;

class SellerStatsService
{
    /** @return array<string, mixed> */
    public function aggregate(User $user): array
    {
        $listings = Listing::query()->where('user_id', $user->id);

        $byStatus = Listing::query()
            ->where('user_id', $user->id)
            ->selectRaw('status, COUNT(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status')
            ->mapWithKeys(fn ($cnt, $status) => [(string) $status => (int) $cnt])
            ->all();

        return [
            'active' => (int) Listing::query()
                ->where('user_id', $user->id)
                ->where('status', ListingStatus::Published)
                ->count(),
            'total' => (int) $listings->count(),
            'views_total' => (int) Listing::query()
                ->where('user_id', $user->id)
                ->sum('views_count'),
            'favorites_total' => (int) Listing::query()
                ->where('user_id', $user->id)
                ->sum('favorites_count'),
            'by_status' => $byStatus,
        ];
    }

    /**
     * @return list<array{date: string, count: int}>
     */
    public function viewsDaily(User $user, string $range = '30d'): array
    {
        $days = match ($range) {
            '7d' => 7,
            '90d' => 90,
            default => 30,
        };

        $from = now()->subDays($days - 1)->startOfDay();

        $rows = ListingViewDaily::query()
            ->selectRaw('view_date, SUM(views_count) as total')
            ->whereIn('listing_id', Listing::query()->where('user_id', $user->id)->select('id'))
            ->where('view_date', '>=', $from->toDateString())
            ->groupBy('view_date')
            ->orderBy('view_date')
            ->get()
            ->keyBy(fn ($row) => Carbon::parse($row->view_date)->toDateString());

        $result = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $from->copy()->addDays($i)->toDateString();
            $result[] = [
                'date' => $date,
                'count' => (int) ($rows[$date]->total ?? 0),
            ];
        }

        return $result;
    }

    public function recordDailyView(Listing $listing): void
    {
        $today = now()->toDateString();

        $record = ListingViewDaily::query()->firstOrCreate(
            ['listing_id' => $listing->id, 'view_date' => $today],
            ['views_count' => 0],
        );
        $record->increment('views_count');
    }
}
