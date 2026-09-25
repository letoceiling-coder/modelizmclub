<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ручное напоминание организатора — отдельной колонкой (C7).
 *
 * Не переиспользуем `reminder_sent_at`: им помечено автоматическое
 * напоминание за сутки, и запись туда погасила бы его. Организатор,
 * напомнивший за пять дней, лишил бы участников того напоминания,
 * которое приходит накануне, — то есть самого полезного.
 *
 * Колонка нужна, чтобы ограничить частоту: без неё кнопка рассылает
 * столько раз, сколько по ней нажали.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('club_events', function (Blueprint $table): void {
            $table->timestamp('manual_reminder_at')->nullable()->after('reminder_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('club_events', function (Blueprint $table): void {
            $table->dropColumn('manual_reminder_at');
        });
    }
};
