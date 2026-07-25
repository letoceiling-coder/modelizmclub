<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** OAuth used to set phone_verified_at without SMS — reset unless a code was consumed. */
    public function up(): void
    {
        DB::table('users')
            ->whereNotNull('phone_verified_at')
            ->whereNotExists(function ($q): void {
                $q->select(DB::raw(1))
                    ->from('phone_verification_codes')
                    ->whereColumn('phone_verification_codes.user_id', 'users.id')
                    ->whereNotNull('used_at');
            })
            ->update(['phone_verified_at' => null]);
    }

    public function down(): void
    {
        // Irreversible — SMS re-verification required.
    }
};
