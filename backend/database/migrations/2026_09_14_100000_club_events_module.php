<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Модуль мероприятий: события сообществ и площадки — одна таблица.
 *
 * До 14.09 мероприятия жили только у сообществ (`community_events`), а
 * «событие площадки» было баннером без события за ним: кнопка открывала
 * заглушку. Два вида различаются правами и видимостью, а карточка, страница,
 * отметка «пойду», участники и напоминание у них общие — поэтому одна таблица
 * с признаком `scope`, а различие — в EventPolicy.
 *
 * - `scope`: community — у сообщества, platform — событие площадки;
 * - `status`: draft | published | cancelled. «Прошло» не хранится —
 *   считается по starts_at;
 * - `cancelled_at`, `cancel_reason` — отмена владельцем или ночной задачей
 *   после удаления сообщества;
 * - `reminder_sent_at` — напоминание за сутки ушло, второй раз не шлём;
 * - мягкое удаление: из админки и владельцем — строка остаётся для аудита;
 * - `banners.event_id` — баннер ведёт на событие площадки, регистрация
 *   прямо из ленты.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('community_events', 'club_events');
        Schema::rename('community_event_attendees', 'club_event_attendees');

        Schema::table('club_events', function (Blueprint $table): void {
            $table->string('scope', 16)->default('community')->after('uuid');
            $table->string('status', 16)->default('published')->after('scope');
            $table->timestamp('cancelled_at')->nullable()->after('cover_media_id');
            $table->string('cancel_reason', 255)->nullable()->after('cancelled_at');
            $table->timestamp('reminder_sent_at')->nullable()->after('cancel_reason');
            $table->softDeletes();
            $table->index(['scope', 'status', 'starts_at']);
        });

        DB::statement('ALTER TABLE club_events ALTER COLUMN community_id DROP NOT NULL');
        DB::statement(<<<'SQL'
            ALTER TABLE club_events ADD CONSTRAINT club_events_scope_community_check CHECK (
                (scope = 'community' AND community_id IS NOT NULL)
                OR (scope = 'platform' AND community_id IS NULL)
            )
        SQL);
        DB::statement(<<<'SQL'
            ALTER TABLE club_events ADD CONSTRAINT club_events_status_check
                CHECK (status IN ('draft', 'published', 'cancelled'))
        SQL);

        Schema::table('club_event_attendees', function (Blueprint $table): void {
            $table->index(['user_id', 'event_id']);
        });

        Schema::table('banners', function (Blueprint $table): void {
            $table->foreignId('event_id')->nullable()->after('link_url')
                ->constrained('club_events')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('event_id');
        });

        Schema::table('club_event_attendees', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'event_id']);
        });

        // Событиям площадки в старой схеме места нет: сообщество обязательно.
        DB::table('club_events')->where('scope', 'platform')->delete();

        DB::statement('ALTER TABLE club_events DROP CONSTRAINT IF EXISTS club_events_status_check');
        DB::statement('ALTER TABLE club_events DROP CONSTRAINT IF EXISTS club_events_scope_community_check');
        DB::statement('ALTER TABLE club_events ALTER COLUMN community_id SET NOT NULL');

        Schema::table('club_events', function (Blueprint $table): void {
            $table->dropIndex(['scope', 'status', 'starts_at']);
            $table->dropSoftDeletes();
            $table->dropColumn(['scope', 'status', 'cancelled_at', 'cancel_reason', 'reminder_sent_at']);
        });

        Schema::rename('club_event_attendees', 'community_event_attendees');
        Schema::rename('club_events', 'community_events');
    }
};
