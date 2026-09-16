<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Обычная сделка — продажа, о которой договорились в переписке.
 *
 * До 17.09 такой сущности не было: в данных жили только безопасные сделки
 * (`safe_deals`) и личные чаты с `listing_id`, где `listing_id` — последнее
 * объявление, о котором писали, а не факт продажи. `listings.sold_at` и
 * статус `sold` существовали, но `sold_at` не выставлялся нигде.
 *
 * Запись появляется, когда продавец в чате отмечает «Продано этому
 * покупателю». Покупатель может ответить «Я не покупал», продавец — снять
 * отметку; и то и другое гасит запись и возвращает лот в продажу.
 * Действующей у лота может быть только одна.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ordinary_deals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('listing_id')->constrained('listings')->restrictOnDelete();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->unsignedBigInteger('amount_kopecks')->default(0);
            $table->string('status', 24)->default('active');
            $table->timestamp('declined_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index(['seller_id', 'status']);
            $table->index(['conversation_id', 'status']);
        });

        DB::statement("CREATE UNIQUE INDEX ordinary_deals_one_active_per_listing ON ordinary_deals (listing_id) WHERE status = 'active'");
    }

    public function down(): void
    {
        Schema::dropIfExists('ordinary_deals');
    }
};
