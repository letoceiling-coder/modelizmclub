<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * «Позвонить продавцу».
 *
 * `listings.show_phone` — выбор продавца, по умолчанию включён: показывать
 * номер решено площадкой, продавец может отказаться.
 *
 * `listing_phone_reveals` — журнал раскрытий: кто, какое объявление, чей
 * номер, откуда и когда. Он же — источник лимита частоты (SellerPhoneRevealService).
 * Ссылки обнуляются, а не каскадят: запись о раскрытии нужна и после
 * удаления объявления или учётки, когда придёт жалоба на обзвон.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->boolean('show_phone')->default(true)->after('contact_via_messenger');
        });

        Schema::create('listing_phone_reveals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_id')->nullable()->constrained('listings')->nullOnDelete();
            $table->foreignId('viewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('seller_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('provider', 32);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at');

            $table->index(['viewer_id', 'created_at']);
            $table->index(['ip_address', 'created_at']);
            $table->index(['seller_id', 'created_at']);
            $table->index(['listing_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_phone_reveals');
        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn('show_phone');
        });
    }
};
