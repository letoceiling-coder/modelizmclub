<?php

namespace App\Console\Commands;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Illuminate\Console\Command;
use Modules\Delivery\Services\ShipmentService;

class SyncDeliveryStatusesCommand extends Command
{
    protected $signature = 'delivery:sync-statuses {--limit=50 : Max shipments to poll}';

    protected $description = 'Poll CDEK/Yandex APIs for shipment status updates';

    public function handle(ShipmentService $shipments): int
    {
        $limit = (int) $this->option('limit');

        $active = Shipment::query()
            ->whereNotNull('external_id')
            ->whereNotIn('status', [
                ShipmentStatus::Delivered->value,
                ShipmentStatus::Cancelled->value,
                ShipmentStatus::Error->value,
            ])
            ->orderBy('updated_at')
            ->limit($limit)
            ->get();

        $updated = 0;

        foreach ($active as $shipment) {
            try {
                $before = $shipment->status;
                $shipments->syncStatus($shipment);
                $shipment->refresh();
                if ($shipment->status !== $before) {
                    $updated++;
                }
            } catch (\Throwable $e) {
                $this->warn("Shipment {$shipment->uuid}: {$e->getMessage()}");
            }
        }

        $this->info("Polled {$active->count()} shipments, updated {$updated}.");

        return self::SUCCESS;
    }
}
