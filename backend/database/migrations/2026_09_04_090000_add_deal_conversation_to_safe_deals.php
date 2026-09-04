<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every safe deal gets its own chat (ConversationType::Deal).
 *
 * The link is stored one-way on safe_deals: a deal has at most one chat, while
 * a conversation is a deal chat in this one case only, so a second column on
 * `conversations` would just be a nullable mirror. The reverse direction is a
 * plain hasOne on Conversation and needs no schema.
 *
 * `messages.user_id` becomes nullable so the deal chat can carry authorless
 * system notices ("Сделка №… — Отправлена") without inventing a bot account.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('safe_deals', function (Blueprint $table): void {
            $table->foreignId('conversation_id')->nullable()->after('shipment_id')
                ->constrained('conversations')->nullOnDelete();
        });

        Schema::table('messages', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
        });

        Schema::table('safe_deals', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('conversation_id');
        });
    }
};
