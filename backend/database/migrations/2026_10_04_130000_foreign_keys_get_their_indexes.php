<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Индексы под внешние ключи: 133 колонки в 78 таблицах.
 *
 * Postgres заводит индекс сам только под первичный ключ и уникальность.
 * Под колонку, которая ссылается на чужую строку, — не заводит. Значит
 * каждое удаление или смена ключа у родителя заставляет его просмотреть
 * дочернюю таблицу целиком, чтобы убедиться, что ссылок не осталось.
 *
 * Это не ускорение «на всякий случай», а условие, без которого обычные
 * действия становятся тем дороже, чем больше данных. Удаление одного
 * пользователя трогает несколько десятков таблиц из этого списка.
 *
 * Сейчас это ничего не замедляет, и говорить иначе было бы неправдой:
 * база 37 МБ, 56 учётных записей, и такую таблицу Postgres прочитает
 * целиком быстрее, чем пойдёт по индексу. Замер 04.10 — к росту, а не к
 * сегодняшнему дню. Цена тоже названа честно: каждая запись в эти
 * таблицы становится чуть дороже, а база — чуть больше.
 *
 * Список не выдуман, а снят с самой схемы запросом к pg_constraint:
 * одноколоночные внешние ключи, под которыми нет индекса, начинающегося с
 * той же колонки. Составные ключи и колонки, уже покрытые первым полем
 * составного индекса, сюда не попали — им отдельный индекс не нужен.
 *
 * Имена индексов — умолчание Laravel `{таблица}_{колонка}_index`; самое
 * длинное укладывается в предел Postgres (63 знака) с запасом.
 */
return new class extends Migration
{
    /** таблица => колонки, под которые нужен индекс. */
    private const СТОЛБЦЫ = [
        'admin_permission_grants' => ['granted_by'],
        'banner_events' => ['user_id'],
        'banners' => ['event_id', 'image_media_id'],
        'category_admins' => ['assigned_by'],
        'channel_admins' => ['user_id'],
        'channel_applications' => ['avatar_media_id', 'banner_media_id', 'reviewed_by'],
        'channel_post_likes' => ['user_id'],
        'channel_post_media' => ['channel_post_id', 'media_id'],
        'channel_posts' => ['author_id'],
        'channel_subscriptions' => ['user_id'],
        'channels' => ['avatar_media_id', 'banner_media_id', 'owner_id'],
        'club_events' => ['cover_media_id', 'created_by'],
        'comment_media' => ['media_id'],
        'comment_reactions' => ['user_id'],
        'comments' => ['parent_id'],
        'communities' => ['avatar_media_id', 'category_id', 'city_id', 'cover_media_id', 'created_by'],
        'community_applications' => ['category_id', 'reviewed_by', 'user_id'],
        'community_join_requests' => ['reviewed_by', 'user_id'],
        'community_members' => ['user_id'],
        'community_pinned_posts' => ['post_id'],
        'community_topic_categories' => ['post_category_id'],
        'consent_logs' => ['user_id'],
        'conversation_participants' => ['user_id'],
        'conversations' => ['community_id', 'listing_id', 'pinned_message_id', 'post_category_id'],
        'cookie_preferences' => ['user_id'],
        'delivery_quotes' => ['shipment_id'],
        'disputes' => ['opened_by', 'resolved_by'],
        'escrow_transactions' => ['actor_id', 'wallet_transaction_id'],
        'faq_articles' => ['category_id'],
        'feedback' => ['replied_by'],
        'icon_assets' => ['uploaded_by'],
        'landing_cards' => ['post_category_id'],
        'legal_page_revisions' => ['user_id'],
        'legal_pages' => ['video_media_id'],
        'listing_categories' => ['parent_id'],
        'listing_favorites' => ['listing_id'],
        'listing_pricing_rules' => ['category_id'],
        'listing_status_logs' => ['actor_id', 'listing_id'],
        'listings' => ['city_id', 'moderated_by', 'placement_payment_id', 'placement_promocode_id', 'subcategory_id'],
        'message_read_receipts' => ['user_id'],
        'messages' => ['forwarded_from_message_id', 'listing_id', 'post_id', 'reply_to_id'],
        'moderation_actions' => ['actor_id'],
        'moderation_queue' => ['assigned_to'],
        'payment_items' => ['payment_id'],
        'pending_email_changes' => ['user_id'],
        'personal_data_consents' => ['user_id'],
        'post_bookmarks' => ['post_id'],
        'post_categories' => ['community_category_id', 'listing_category_id', 'parent_id'],
        'post_hashtags' => ['tag_id'],
        'post_reactions' => ['user_id'],
        'posts' => ['moderated_by', 'repost_of_id', 'subcategory_id'],
        'promo_pool_users' => ['user_id'],
        'promocode_usages' => ['payment_id', 'promocode_id', 'user_id'],
        'promocode_users' => ['user_id'],
        'promocodes' => ['listing_category_id', 'user_id'],
        'reports' => ['reporter_id', 'resolved_by'],
        'rule_page_revisions' => ['user_id'],
        'safe_deal_gateway_events' => ['incoming_payment_id', 'payout_id', 'safe_deal_id'],
        'safe_deal_incoming_payments' => ['buyer_id', 'payment_id'],
        'safe_deals' => ['conversation_id', 'hold_transaction_id', 'listing_id', 'payout_transaction_id', 'refund_transaction_id', 'shipment_id'],
        'seller_delivery_profiles' => ['city_id'],
        'shipments' => ['conversation_id', 'listing_id', 'safe_deal_id', 'seller_point_id'],
        'support_messages' => ['ticket_id', 'user_id'],
        'support_tickets' => ['assigned_to', 'user_id'],
        'upload_sessions' => ['user_id'],
        'user_blocks' => ['blocked_id'],
        'user_follows' => ['following_id'],
        'user_friendships' => ['friend_id'],
        'user_interests' => ['category_id'],
        'user_oauth_accounts' => ['user_id'],
        'user_profiles' => ['avatar_media_id', 'city_id', 'cover_media_id'],
        'user_reviews' => ['author_id'],
        'user_subscriptions' => ['granted_by_admin_id', 'plan_id'],
        'users' => ['promo_pool_id', 'referred_by'],
        'video_reactions' => ['user_id'],
        'video_views' => ['user_id'],
        'videos' => ['category_id', 'poster_media_id', 'uploader_id', 'video_media_id'],
        'withdrawal_requests' => ['wallet_transaction_id'],
    ];

    public function up(): void
    {
        foreach (self::СТОЛБЦЫ as $таблица => $колонки) {
            if (! Schema::hasTable($таблица)) {
                continue;
            }

            Schema::table($таблица, function (Blueprint $table) use ($таблица, $колонки): void {
                foreach ($колонки as $колонка) {
                    // Повторный прогон не должен падать: индекс мог появиться
                    // отдельной веткой между написанием и выкаткой.
                    if ($this->индексЕсть($таблица, $колонка)) {
                        continue;
                    }

                    $table->index($колонка);
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::СТОЛБЦЫ as $таблица => $колонки) {
            if (! Schema::hasTable($таблица)) {
                continue;
            }

            Schema::table($таблица, function (Blueprint $table) use ($таблица, $колонки): void {
                foreach ($колонки as $колонка) {
                    if (! $this->индексЕсть($таблица, $колонка)) {
                        continue;
                    }

                    $table->dropIndex("{$таблица}_{$колонка}_index");
                }
            });
        }
    }

    private function индексЕсть(string $таблица, string $колонка): bool
    {
        return Schema::getConnection()
            ->table('pg_indexes')
            ->where('tablename', $таблица)
            ->where('indexname', "{$таблица}_{$колонка}_index")
            ->exists();
    }
};
