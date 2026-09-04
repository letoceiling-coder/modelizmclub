<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finishes a rollback that was left half-done on 12.08.2026.
 *
 * On 11.08 the migration `2026_08_11_100000_extend_escrow_deals_and_operations`
 * created `escrow_operations` and added fourteen VTB columns to `escrow_deals`.
 * It ran on production. The next day commit d95d8aa rolled the feature back by
 * deleting the migration file — without ever calling its `down()`. The row in
 * the `migrations` table stayed, so Laravel still believes the migration ran,
 * while the file that could undo it no longer exists. The schema audit of
 * 04.09 found this is the entire divergence between production and the
 * migrations: 1 table, 31 columns, 8 indexes, 3 foreign keys, 1 sequence, all
 * of it escrow, and nothing missing in the other direction.
 *
 * The prototype is dead code: `EscrowDeal` and `EscrowDealStatus` were deleted,
 * and grep over app/, routes/, config/ and the frontend finds no reference to
 * either table. The live contour is `SafeDeal` + `EscrowTransaction`, untouched
 * here. `escrow_operations` is empty; `escrow_deals` holds two rows abandoned in
 * `pending_payment` on 11 and 12 August.
 *
 * Every object is dropped by its own name and nothing uses CASCADE. That is
 * deliberate: if production carries some further undocumented object that
 * depends on these tables, this migration must fail and show it rather than
 * quietly take it down too. That is exactly how the 04.09 deploy failed —
 * `escrow_operations` held a foreign key nobody knew about — and the point of
 * this migration is to end that class of surprise, not to repeat it.
 *
 * Dropping the columns before dropping the table is redundant work by design:
 * it makes an unexpected dependency surface against a named column instead of
 * disappearing silently with the table.
 *
 * A database built from migrations alone has none of these extra objects, so
 * every step is guarded. On a fresh database this migration only drops
 * `escrow_deals` (the July prototype table) and finds nothing else to do.
 */
return new class extends Migration
{
    /** The migration whose file was deleted without its `down()` ever running. */
    private const ORPHANED_MIGRATION = '2026_08_11_100000_extend_escrow_deals_and_operations';

    /** VTB columns added to `escrow_deals` on 11.08. */
    private const VTB_COLUMNS = [
        'shipment_id',
        'item_amount_cents',
        'delivery_amount_cents',
        'payment_provider',
        'vtb_order_id',
        'vtb_payment_state',
        'captured_cents',
        'refunded_cents',
        'paid_out_cents',
        'fee_snapshot',
        'frozen_at',
        'freeze_reason',
        'dispute_status',
        'admin_note',
    ];

    /** Indexes the same migration added to `escrow_deals`. */
    private const VTB_INDEXES = [
        'escrow_deals_shipment_id_index',
        'escrow_deals_payment_provider_index',
        'escrow_deals_vtb_order_id_index',
        'escrow_deals_dispute_status_index',
    ];

    public function up(): void
    {
        // 1. The operations log. Its two foreign keys, four indexes and the id
        //    sequence belong to the table and go with it.
        if (Schema::hasTable('escrow_operations')) {
            Schema::drop('escrow_operations');
        }

        // 2. The VTB extension of escrow_deals: the foreign key first, then the
        //    indexes, then the columns — each by name.
        if (Schema::hasTable('escrow_deals')) {
            $present = array_values(array_filter(
                self::VTB_COLUMNS,
                static fn (string $column): bool => Schema::hasColumn('escrow_deals', $column),
            ));

            if (Schema::hasColumn('escrow_deals', 'shipment_id')) {
                Schema::table('escrow_deals', function (Blueprint $table): void {
                    $table->dropForeign('escrow_deals_shipment_id_foreign');
                });
            }

            $indexes = $this->existingIndexes('escrow_deals', self::VTB_INDEXES);
            if ($indexes !== []) {
                Schema::table('escrow_deals', function (Blueprint $table) use ($indexes): void {
                    foreach ($indexes as $index) {
                        $table->dropIndex($index);
                    }
                });
            }

            if ($present !== []) {
                Schema::table('escrow_deals', function (Blueprint $table) use ($present): void {
                    $table->dropColumn($present);
                });
            }

            // 3. The prototype table itself, created 15.07 and never wired to a
            //    route or a controller.
            Schema::drop('escrow_deals');
        }

        // 4. The bookkeeping row for a migration whose file no longer exists.
        //    Without this, `migrate:status` keeps reporting a migration that
        //    cannot be found, and the schema audit keeps flagging it.
        DB::table('migrations')->where('migration', self::ORPHANED_MIGRATION)->delete();
    }

    public function down(): void
    {
        throw new RuntimeException(
            'Rolling this back is not possible and pretending otherwise is what created the problem. '
            .'Recreating the tables would give back empty structures that no code reads, while the two '
            .'abandoned escrow_deals rows would stay gone. To restore the real state, take the pre-deploy '
            .'dump from /root/backups/auto/pre-deploy/ (also in s3://backups/pre-deploy/) and restore the '
            .'escrow_deals and escrow_operations tables from it; the original definitions live in git at '
            .'2026_07_15_140000_create_escrow_deals.php and in commit 1cad8a6, whose migration file was '
            .'deleted by d95d8aa.'
        );
    }

    /**
     * Index names that actually exist, so a fresh database — where the VTB
     * extension never ran — does not fail on a missing index.
     *
     * @param  list<string>  $candidates
     * @return list<string>
     */
    private function existingIndexes(string $table, array $candidates): array
    {
        $existing = array_column(
            DB::select('select indexname from pg_indexes where schemaname = current_schema() and tablename = ?', [$table]),
            'indexname',
        );

        return array_values(array_intersect($candidates, $existing));
    }
};
