<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Кто выдал подписку руками.
 *
 * До этой колонки у подписки было ровно два основания жить: оплаченный
 * Payment и промо-признак. Ручная выдача из админки не давала ни того, ни
 * другого — строка появлялась, `hasActiveSubscription()` возвращал false, и
 * пользователь не получал ничего, хотя админка отвечала `is_active: true`.
 *
 * Колонка делает третье основание явным. Не выписываем фиктивный «оплаченный»
 * платёж: он попал бы в выгрузки и отчёты по выручке как настоящие деньги.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_subscriptions', function (Blueprint $table): void {
            $table->foreignId('granted_by_admin_id')
                ->nullable()
                ->after('plan_id')
                ->constrained('users')
                ->nullOnDelete();

            // Спрашивают всегда вместе с user_id и status: «есть ли у этого
            // человека живая выданная подписка».
            $table->index(['user_id', 'granted_by_admin_id'], 'user_subscriptions_user_granted_index');
        });
    }

    public function down(): void
    {
        Schema::table('user_subscriptions', function (Blueprint $table): void {
            $table->dropIndex('user_subscriptions_user_granted_index');
            $table->dropConstrainedForeignId('granted_by_admin_id');
        });
    }
};
