<?php

use App\Models\Payment;
use App\Models\UserSubscription;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $paidUserIds = Payment::query()
            ->where('status', 'paid')
            ->where(function ($q): void {
                $q->whereNotNull('metadata->plan_id')
                    ->orWhere('metadata->payable_type', 'subscription');
            })
            ->pluck('user_id')
            ->unique()
            ->all();

        $query = UserSubscription::query()->where('status', 'active');

        if ($paidUserIds !== []) {
            $query->whereNotIn('user_id', $paidUserIds);
        }

        $query->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'auto_renew' => false,
        ]);
    }

    public function down(): void
    {
        // Promo grants cannot be restored safely after cancellation.
    }
};
