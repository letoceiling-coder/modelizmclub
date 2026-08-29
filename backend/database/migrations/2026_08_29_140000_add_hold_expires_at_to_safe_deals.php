<?php

use App\Models\SafeDeal;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('safe_deals', function (Blueprint $table) {
            $table->timestamp('hold_expires_at')->nullable()->after('paid_at');
        });

        SafeDeal::query()
            ->whereNotNull('paid_at')
            ->whereNull('hold_expires_at')
            ->orderBy('id')
            ->each(function (SafeDeal $deal): void {
                $deal->forceFill([
                    'hold_expires_at' => $deal->paid_at?->copy()->addDays(14),
                ])->save();
            });
    }

    public function down(): void
    {
        Schema::table('safe_deals', function (Blueprint $table) {
            $table->dropColumn('hold_expires_at');
        });
    }
};
