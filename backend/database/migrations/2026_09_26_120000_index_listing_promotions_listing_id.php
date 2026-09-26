<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Индекс под подзапрос срока продвижения.
 *
 * `listing_id` объявлен внешним ключом, а Postgres под внешний ключ индекс
 * не создаёт — в отличие от MySQL. До 26.09 у таблицы был только первичный
 * ключ, и `max(paid_until)` по объявлению сканировал её целиком.
 *
 * Пока это делалось запросом на карточку, стоимость была видна снаружи как
 * N+1. Теперь подзапрос встроен в запрос ленты — тот самый, который обязан
 * быть быстрым, — и сканирование переехало внутрь него. Строк в таблице
 * сейчас мало, разницы не видно; ставится именно поэтому, а не когда станет
 * видно: `activate()` вставляет строку на каждое продвижение, и никто их не
 * удаляет.
 *
 * `paid_until` второй колонкой, чтобы максимум брался из индекса.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listing_promotions', function (Blueprint $table): void {
            $table->index(['listing_id', 'paid_until'], 'listing_promotions_listing_paid_index');
        });
    }

    public function down(): void
    {
        Schema::table('listing_promotions', function (Blueprint $table): void {
            $table->dropIndex('listing_promotions_listing_paid_index');
        });
    }
};
