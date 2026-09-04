<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PurgeUserContentCommand extends Command
{
    protected $signature = 'db:purge-content
        {--keep=* : Admin emails to preserve}
        {--dry-run : Show plan without mutating data}
        {--force : Skip confirmation prompt}';

    protected $description = 'Remove all user-generated content; keep categories and system/reference data.';

    /** @var list<string> */
    private const CONTENT_TABLES = [
        'message_user_hides',
        'message_read_receipts',
        'message_attachments',
        'messages',
        'conversation_participants',
        'conversations',
        'listing_view_daily',
        'listing_promotions',
        'listing_status_logs',
        'listing_favorites',
        'listing_media',
        'listings',
        'post_hashtags',
        'post_reactions',
        'post_bookmarks',
        'post_reposts',
        'comment_reactions',
        'comments',
        'community_pinned_posts',
        'post_media',
        'posts',
        'community_members',
        'community_applications',
        'community_subcategories',
        'communities',
        'channel_post_media',
        'channel_posts',
        'channel_subscriptions',
        'channels',
        'channel_applications',
        'video_reactions',
        'video_views',
        'media_transcripts',
        'videos',
        'media_attachments',
        'media',
        'upload_sessions',
        'friend_requests',
        'user_friendships',
        'user_follows',
        'user_blocks',
        'user_interests',
        'user_view_history',
        'user_reviews',
        'reports',
        'feedback',
        'moderation_queue',
        'moderation_actions',
        'banner_events',
        'notifications',
        'call_logs',
        'client_logs',
        'audit_logs',
        'support_messages',
        'support_tickets',
        'shipment_events',
        'shipments',
        'delivery_quotes',
        'seller_delivery_profiles',
        'payment_items',
        'payments',
        'user_subscriptions',
        'promocode_usages',
        'bonus_transactions',
        'bonus_accounts',
        'saved_payment_methods',
        'user_payout_requisites',
        'user_document_requisites',
        'pending_email_changes',
        'taggables',
        'jobs',
        'failed_jobs',
        'sessions',
        'email_verification_codes',
        'password_reset_tokens',
    ];

    public function handle(): int
    {
        $keepEmails = array_values(array_filter(array_map(
            static fn (string $e) => strtolower(trim($e)),
            $this->option('keep') ?: [],
        )));

        if ($keepEmails === []) {
            $this->error('Provide at least one --keep=email@example.com');

            return self::FAILURE;
        }

        $keepers = User::withTrashed()
            ->where(function ($q) use ($keepEmails): void {
                foreach ($keepEmails as $email) {
                    $q->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->get();

        if ($keepers->count() !== count($keepEmails)) {
            $found = $keepers->pluck('email')->map(static fn ($e) => strtolower((string) $e))->all();
            $missing = array_values(array_diff($keepEmails, $found));
            $this->error('Keeper accounts not found: '.implode(', ', $missing));

            return self::FAILURE;
        }

        $keeperIds = $keepers->pluck('id')->all();
        $otherUsers = User::withTrashed()->whereNotIn('id', $keeperIds)->count();

        $this->info('Keeper accounts:');
        foreach ($keepers as $u) {
            $this->line("  • {$u->email} (id={$u->id}, role={$u->role->value})");
        }
        $this->line("Users to delete: {$otherUsers}");
        $this->line('Preserved: categories, cities, tags, delivery methods, plans, promocodes, FAQ, legal docs, system settings, banners, icon assets, moderation rules.');

        if ($this->option('dry-run')) {
            $this->warn('Dry run — no changes made.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm('This permanently deletes production user content. Continue?')) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($keeperIds, $keepers): void {
            $existing = array_values(array_filter(
                self::CONTENT_TABLES,
                static fn (string $t) => Schema::hasTable($t),
            ));

            if ($existing !== []) {
                $list = implode(', ', array_map(static fn (string $t) => '"'.$t.'"', $existing));
                DB::statement("TRUNCATE TABLE {$list} RESTART IDENTITY CASCADE");
                $this->info('Truncated '.count($existing).' content tables.');
            }

            if (Schema::hasTable('tags')) {
                DB::table('tags')->update(['usage_count' => 0]);
            }

            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')->whereNotIn('tokenable_id', $keeperIds)
                    ->where('tokenable_type', 'App\\Models\\User')
                    ->delete();
            }

            foreach (['model_has_roles', 'model_has_permissions'] as $pivot) {
                if (Schema::hasTable($pivot)) {
                    DB::table($pivot)
                        ->where('model_type', 'App\\Models\\User')
                        ->whereNotIn('model_id', $keeperIds)
                        ->delete();
                }
            }

            $userChildTables = [
                'user_oauth_accounts',
                'notification_preferences',
                'personal_data_consents',
                'admin_two_factor',
                'user_two_factor',
            ];
            foreach ($userChildTables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->whereNotIn('user_id', $keeperIds)->delete();
                }
            }

            if (Schema::hasTable('user_profiles')) {
                UserProfile::query()->whereNotIn('user_id', $keeperIds)->delete();
            }

            User::withTrashed()->whereNotIn('id', $keeperIds)->forceDelete();

            foreach ($keepers as $user) {
                if ($user->trashed()) {
                    $user->restore();
                }
                if ($user->role !== UserRole::Admin) {
                    $user->forceFill(['role' => UserRole::Admin, 'status' => $user->status])->save();
                }
                UserProfile::query()->firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'display_name' => $user->name ?: explode('@', (string) $user->email)[0],
                        'slug' => 'user-'.$user->id,
                        'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
                    ],
                );
            }
        });

        $remaining = User::query()->count();
        $this->info("Done. Remaining users: {$remaining}");

        return self::SUCCESS;
    }
}
