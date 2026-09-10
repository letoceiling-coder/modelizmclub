<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Подготовка к уборке журналов: место, куда сворачивается статистика
 * баннеров, и индексы, по которым уборка ищет старые строки.
 *
 * banner_event_daily. Удалять сырые показы, ничего не сохранив, значило бы
 * терять разбивку по дням навсегда. Итоговые счётчики у баннера
 * (impressions_count, clicks_count) её не дают: они монотонно растут и не
 * знают, когда именно был показ. Дневная свёртка занимает одну строку на
 * баннер, событие и день — при десяти баннерах это семь строк в сутки
 * против тысяч сырых.
 *
 * День считается по московскому стенному времени: created_at объявлен
 * `timestamp without time zone` и хранит именно его, поэтому `::date`
 * режет сутки там же, где их видит пользователь. Приводить к UTC нельзя —
 * получится смещение на три часа, ровно та ловушка, что описана в CLAUDE.md.
 *
 * Индексы на created_at. Уборка спрашивает `where created_at < ?` без
 * других условий. У client_logs есть (level, created_at) и
 * (user_id, created_at) — в обоих created_at вторая колонка, и для запроса
 * без первой они не годятся. У banner_events та же история с
 * (banner_id, event, created_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banner_event_daily', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('banner_id')->constrained()->cascadeOnDelete();
            $table->string('event', 32);
            $table->date('day');
            $table->unsignedBigInteger('count')->default(0);
            $table->timestamps();

            $table->unique(['banner_id', 'event', 'day'], 'banner_event_daily_unique');
            $table->index('day', 'banner_event_daily_day_index');
        });

        Schema::table('client_logs', function (Blueprint $table): void {
            $table->index('created_at', 'client_logs_created_at_index');
        });

        Schema::table('banner_events', function (Blueprint $table): void {
            $table->index('created_at', 'banner_events_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('banner_events', function (Blueprint $table): void {
            $table->dropIndex('banner_events_created_at_index');
        });

        Schema::table('client_logs', function (Blueprint $table): void {
            $table->dropIndex('client_logs_created_at_index');
        });

        Schema::dropIfExists('banner_event_daily');
    }
};
