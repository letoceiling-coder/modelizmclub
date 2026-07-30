<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** VK OAuth users must not require email confirmation; Yandex emails are provider-verified. */
    public function up(): void
    {
        $now = now();

        DB::table('users')
            ->whereNull('email_verified_at')
            ->whereIn('id', function ($query): void {
                $query->select('user_id')
                    ->from('user_oauth_accounts')
                    ->where('provider', 'vk');
            })
            ->update(['email_verified_at' => $now]);

        DB::table('users')
            ->whereNull('email_verified_at')
            ->where('email', 'not like', '%@oauth.modelizmclub.local')
            ->whereIn('id', function ($query): void {
                $query->select('user_id')
                    ->from('user_oauth_accounts')
                    ->where('provider', 'yandex');
            })
            ->update(['email_verified_at' => $now]);
    }

    public function down(): void
    {
        // Irreversible — prior verification state is unknown.
    }
};
