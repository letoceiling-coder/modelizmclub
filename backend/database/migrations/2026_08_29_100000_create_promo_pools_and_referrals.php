<?php

use App\Support\FirstHundredPromo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promo_pools', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->unsignedInteger('max_activations')->default(300);
            $table->unsignedInteger('current_activations')->default(0);
            $table->timestampTz('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('auto_assign_on_register')->default(true);
            $table->string('plan_slug', 64)->default('year');
            $table->unsignedInteger('bonus_kopecks')->default(0);
            $table->timestampTz('paused_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('referrals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('inviter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('invitee_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('status', 24)->default('pending');
            $table->unsignedInteger('listing_credits')->default(0);
            $table->unsignedInteger('subscription_days')->default(0);
            $table->timestampTz('completed_at')->nullable();
            $table->timestamps();

            $table->index(['inviter_id', 'status']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('promo_pool_id')->nullable()->after('first_hundred_granted_at')
                ->constrained('promo_pools')->nullOnDelete();
            $table->unsignedInteger('referral_click_count')->default(0)->after('listing_placement_credits');
        });

        $this->seedLegacyPool();
        $this->backfillPendingReferrals();
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('promo_pool_id');
            $table->dropColumn('referral_click_count');
        });
        Schema::dropIfExists('referrals');
        Schema::dropIfExists('promo_pools');
    }

    private function seedLegacyPool(): void
    {
        $raw = DB::table('system_settings')->where('key', FirstHundredPromo::SETTING_KEY)->value('value');
        $config = FirstHundredPromo::normalize(is_string($raw) ? json_decode($raw, true) : $raw);
        $taken = (int) DB::table('users')->where('is_first_hundred', true)->count();

        if (! $config['enabled'] && $taken === 0 && $config['total'] <= 0) {
            return;
        }

        $id = DB::table('promo_pools')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'name' => 'Первые '.$config['total'].' пользователей',
            'max_activations' => max(1, $config['total']),
            'current_activations' => $taken,
            'expires_at' => '2026-12-31 23:59:59',
            'is_active' => $config['enabled'],
            'auto_assign_on_register' => $config['enabled'],
            'plan_slug' => $config['plan_slug'] ?: 'year',
            'bonus_kopecks' => $config['bonus_kopecks'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->where('is_first_hundred', true)->update(['promo_pool_id' => $id]);
    }

    private function backfillPendingReferrals(): void
    {
        $rows = DB::table('users')
            ->whereNotNull('referred_by')
            ->select(['id', 'referred_by', 'phone_verified_at', 'created_at'])
            ->get();

        foreach ($rows as $row) {
            $verified = $row->phone_verified_at !== null;
            DB::table('referrals')->insert([
                'uuid' => (string) Str::uuid(),
                'inviter_id' => $row->referred_by,
                'invitee_id' => $row->id,
                'status' => $verified ? 'completed' : 'pending',
                'listing_credits' => 0,
                'subscription_days' => 0,
                'completed_at' => $verified ? $row->phone_verified_at : null,
                'created_at' => $row->created_at,
                'updated_at' => now(),
            ]);
        }
    }
};
