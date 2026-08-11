<?php

namespace Modules\Admin\Services;

use App\Models\EscrowDeal;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class AdminEscrowQueryService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = EscrowDeal::query()
            ->with([
                'listing:id,uuid,title,slug,price_cents',
                'buyer.profile:user_id,display_name,slug',
                'seller.profile:user_id,display_name,slug',
                'shipment:id,uuid,provider,status,tracking_number,delivery_cost_cents',
                'payment:id,uuid,provider,status,provider_payment_id',
            ])
            ->latest();

        $this->applyFilters($query, $filters);

        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return $query->paginate($perPage);
    }

    public function show(string $uuid): EscrowDeal
    {
        return EscrowDeal::query()
            ->where('uuid', $uuid)
            ->with([
                'listing',
                'buyer.profile',
                'seller.profile',
                'shipment.events',
                'payment',
                'operations.adminUser.profile',
            ])
            ->firstOrFail();
    }

    /**
     * @param  Builder<EscrowDeal>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['payment_provider'])) {
            $query->where('payment_provider', $filters['payment_provider']);
        }

        if (! empty($filters['buyer_id'])) {
            $query->where('buyer_id', (int) $filters['buyer_id']);
        }

        if (! empty($filters['seller_id'])) {
            $query->where('seller_id', (int) $filters['seller_id']);
        }

        if (! empty($filters['dispute']) && $filters['dispute'] === 'open') {
            $query->where('dispute_status', 'open');
        }

        if (! empty($filters['frozen']) && filter_var($filters['frozen'], FILTER_VALIDATE_BOOLEAN)) {
            $query->whereNotNull('frozen_at');
        }

        if (! empty($filters['shipment_status'])) {
            $query->whereHas('shipment', fn (Builder $q) => $q->where('status', $filters['shipment_status']));
        }

        if (! empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        if (! empty($filters['q'])) {
            $term = (string) $filters['q'];
            $like = '%'.$term.'%';
            $query->where(function (Builder $q) use ($like): void {
                $q->where('uuid', 'like', $like)
                    ->orWhereHas('listing', fn (Builder $l) => $l->where('title', 'like', $like))
                    ->orWhereHas('buyer.profile', fn (Builder $p) => $p->where('display_name', 'like', $like))
                    ->orWhereHas('seller.profile', fn (Builder $p) => $p->where('display_name', 'like', $like));
            });
        }
    }
}
