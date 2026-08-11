<?php

namespace Modules\Admin\Services;

use App\Enums\EscrowDealStatus;
use App\Enums\EscrowOperationStatus;
use App\Models\EscrowDeal;
use App\Models\EscrowOperation;
use Illuminate\Support\Facades\DB;

class AdminEscrowStatsService
{
    public function stats(): array
    {
        $terminal = [
            EscrowDealStatus::Completed->value,
            EscrowDealStatus::Cancelled->value,
            EscrowDealStatus::Refunded->value,
            EscrowDealStatus::Reversed->value,
            EscrowDealStatus::Failed->value,
        ];

        $active = EscrowDeal::query()->whereNotIn('status', $terminal)->count();

        $onHoldCents = (int) EscrowDeal::query()
            ->whereIn('status', [
                EscrowDealStatus::Funded->value,
                EscrowDealStatus::Paid->value,
                EscrowDealStatus::AwaitingShipment->value,
                EscrowDealStatus::InTransit->value,
                EscrowDealStatus::Delivered->value,
                EscrowDealStatus::AwaitingBuyerConfirm->value,
                EscrowDealStatus::Frozen->value,
            ])
            ->sum('amount_cents');

        $payoutPending = EscrowDeal::query()
            ->where('status', EscrowDealStatus::PayoutPending->value)
            ->count();

        $disputesOpen = EscrowDeal::query()->where('dispute_status', 'open')->count();

        $failedOps7d = EscrowOperation::query()
            ->where('status', EscrowOperationStatus::Failed->value)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        $feePeriodCents = (int) EscrowDeal::query()
            ->where('status', EscrowDealStatus::Completed->value)
            ->where('completed_at', '>=', now()->subDays(30))
            ->sum('platform_fee_cents');

        $byStatus = EscrowDeal::query()
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        return [
            'deals_total' => EscrowDeal::query()->count(),
            'deals_active' => $active,
            'on_hold_cents' => $onHoldCents,
            'payout_pending' => $payoutPending,
            'disputes_open' => $disputesOpen,
            'failed_operations_7d' => $failedOps7d,
            'platform_fee_30d_cents' => $feePeriodCents,
            'deals_by_status' => $byStatus,
        ];
    }
}
