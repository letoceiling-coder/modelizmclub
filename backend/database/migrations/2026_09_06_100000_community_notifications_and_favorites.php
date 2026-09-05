<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Уведомления сообщества и избранное.
 *
 * Хранить эти два состояния было негде: у участника есть только роль и дата
 * вступления, а закладок на сообщества не существовало вовсе. Меню «Ещё» на
 * странице сообщества сейчас показывает подробности, ссылку, жалобу и выход —
 * этих двух пунктов там нет и не могло быть.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_members', function (Blueprint $table): void {
            // По умолчанию включены: вступая в сообщество, человек рассчитывает
            // о нём слышать. Отключение — осознанное действие.
            $table->boolean('notifications_enabled')->default(true);
        });

        // По образцу listing_favorites: составной первичный ключ вместо id,
        // одна отметка времени вместо пары timestamps.
        Schema::create('community_favorites', function (Blueprint $table): void {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['user_id', 'community_id']);
            // Список избранного читается по пользователю, а счётчик у
            // сообщества — по сообществу; первичный ключ покрывает только
            // первый порядок.
            $table->index('community_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_favorites');

        Schema::table('community_members', function (Blueprint $table): void {
            $table->dropColumn('notifications_enabled');
        });
    }
};
