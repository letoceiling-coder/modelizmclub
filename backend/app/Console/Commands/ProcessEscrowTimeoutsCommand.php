<?php

namespace App\Console\Commands;

use App\Enums\EscrowDealStatus;
use App\Models\EscrowDeal;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\EscrowFeeSettings;
use Modules\Billing\Services\EscrowService;

class ProcessEscrowTimeoutsCommand extends Command
{
    protected $signature = 'escrow:process-timeouts {--dry-run : Report only, no changes}';

    protected $description = 'Cancel stale escrow deals, reverse unshipped holds, auto-confirm after delivery window';

    public function handle(EscrowService $escrow, EscrowFeeSettings $settings): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $paymentCutoff = now()->subHours($settings->paymentTimeoutHours());
        $shipCutoff = now()->subDays($settings->sellerShipDeadlineDays());
        $releaseCutoff = now()->subDays($settings->autoReleaseDays());

        $cancelledPending = 0;
        $reversedUnshipped = 0;
        $autoConfirmed = 0;

        $pending = EscrowDeal::query()
            ->where('status', EscrowDealStatus::PendingPayment)
            ->where('created_at', '<', $paymentCutoff)
            ->get();

        foreach ($pending as $deal) {
            if ($dryRun) {
                $this->line("Would cancel pending payment: {$deal->uuid}");
                $cancelledPending++;

                continue;
            }

            $deal->update(['status' => EscrowDealStatus::Cancelled]);
            $cancelledPending++;
        }

        $unshipped = EscrowDeal::query()
            ->with('buyer')
            ->whereIn('status', [
                EscrowDealStatus::Funded,
                EscrowDealStatus::Paid,
                EscrowDealStatus::AwaitingShipment,
            ])
            ->whereNotNull('paid_at')
            ->where('paid_at', '<', $shipCutoff)
            ->get();

        foreach ($unshipped as $deal) {
            if ($dryRun) {
                $this->line("Would reverse unshipped: {$deal->uuid}");
                $reversedUnshipped++;

                continue;
            }

            try {
                if ($deal->payment_provider === 'vtb') {
                    app(\Modules\Billing\Services\VtbEscrowService::class)->cancelHold($deal);
                } else {
                    $deal->update(['status' => EscrowDealStatus::Reversed]);
                }
                $reversedUnshipped++;
            } catch (\Throwable $e) {
                Log::warning('escrow:process-timeouts reverse failed', [
                    'uuid' => $deal->uuid,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $awaitingConfirm = EscrowDeal::query()
            ->with(['buyer', 'shipment'])
            ->where('status', EscrowDealStatus::AwaitingBuyerConfirm)
            ->whereHas('shipment', fn ($q) => $q->whereNotNull('delivered_at')->where('delivered_at', '<', $releaseCutoff))
            ->get();

        foreach ($awaitingConfirm as $deal) {
            if ($dryRun) {
                $this->line("Would auto-confirm: {$deal->uuid}");
                $autoConfirmed++;

                continue;
            }

            try {
                $buyer = $deal->buyer;
                if ($buyer) {
                    $escrow->confirmReceipt($buyer, $deal->fresh(['listing', 'shipment', 'payment']));
                    $autoConfirmed++;
                }
            } catch (\Throwable $e) {
                Log::warning('escrow:process-timeouts auto-confirm failed', [
                    'uuid' => $deal->uuid,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Pending cancelled: {$cancelledPending}, unshipped reversed: {$reversedUnshipped}, auto-confirmed: {$autoConfirmed}");

        return self::SUCCESS;
    }
}
