<?php

use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $rows = UserSubscription::query()
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->get();

        foreach ($rows as $subscription) {
            $user = User::query()->find($subscription->user_id);
            if ($user && $user->hasActiveSubscription()) {
                continue;
            }

            $subscription->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'auto_renew' => false,
            ]);
        }
    }

    public function down(): void
    {
        // Stub-paid grants cannot be restored safely.
    }
};
