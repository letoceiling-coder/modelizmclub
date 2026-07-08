<?php

namespace Modules\Delivery\Services;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdminDeliveryStatsService
{
    public function stats(): array
    {
        $byProvider = Shipment::query()
            ->select('provider', DB::raw('count(*) as total'))
            ->groupBy('provider')
            ->pluck('total', 'provider')
            ->all();

        $byStatus = Shipment::query()
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $revenue = (int) Shipment::query()
            ->whereNotNull('delivery_cost_cents')
            ->where('status', '!=', ShipmentStatus::Cancelled->value)
            ->sum('delivery_cost_cents');

        $errorsLast7d = Shipment::query()
            ->where('status', ShipmentStatus::Error->value)
            ->where('updated_at', '>=', now()->subDays(7))
            ->count();

        $avgDays = Shipment::query()
            ->where('status', ShipmentStatus::Delivered->value)
            ->whereNotNull('created_at_provider')
            ->whereNotNull('delivered_at')
            ->selectRaw('avg(extract(epoch from (delivered_at - created_at_provider)) / 86400) as avg_days')
            ->value('avg_days');

        return [
            'shipments_total' => Shipment::query()->count(),
            'shipments_by_provider' => $byProvider,
            'shipments_by_status' => $byStatus,
            'delivery_revenue_cents' => $revenue,
            'avg_delivery_days' => $avgDays !== null ? round((float) $avgDays, 2) : null,
            'errors_last_7d' => $errorsLast7d,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Shipment::query()
            ->with(['listing', 'seller.profile', 'buyer.profile'])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['provider'] ?? null, fn ($q, $provider) => $q->where('provider', $provider))
            ->when($filters['seller_id'] ?? null, fn ($q, $id) => $q->where('seller_id', $id))
            ->when($filters['buyer_id'] ?? null, fn ($q, $id) => $q->where('buyer_id', $id))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from)))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to)))
            ->latest()
            ->paginate(min((int) ($filters['per_page'] ?? 20), 100));
    }
}
