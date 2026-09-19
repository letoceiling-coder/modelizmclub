<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Льготы на человека, независимо от роли (решение 19.09).
 *
 * subscription_exempt      — подписка не требуется: действия, закрытые
 *                            подпиской, открыты. До этого так работала роль
 *                            (модератор и Владелец проходили по роли); теперь
 *                            это настройка, которую Владелец правит.
 * free_listings_quota      — персональная квота бесплатных размещений;
 * free_listings_unlimited  — «без ограничения»;
 * free_listings_used       — сколько персональной квоты уже израсходовано.
 *
 * «Без ограничения» — отдельный флаг, а не особое число в квоте. NULL как
 * «без ограничения» открывает деньги по ошибке: пустое поле формы или
 * пропущенное значение превращались бы в бесконечные бесплатные
 * размещения. Число вроде −1 требует помнить о нём в каждой арифметике, и
 * забытая проверка тоже меняет смысл. Флаг по умолчанию выключен, квота по
 * умолчанию 0 — любая ошибка даёт «платно», а не «бесплатно навсегда».
 *
 * Квота — на всё время, а не на месяц: у тарифа месячная квота уже есть
 * (subscription_plans.free_listings_per_month), персональную Владелец
 * выдаёт и пополняет сам. Счётчик сбрасывается правкой из админки.
 *
 * placement_free_reason у объявления — почему размещение ничего не стоило:
 * personal_quota, subscription_quota, free_category, subscriber_price,
 * promocode. Раньше был только флаг placement_was_free, и месячная квота
 * тарифа считала им всё подряд — включая бесплатные категории.
 *
 * placement_covered_at — когда размещение состоялось (покрыто квотой,
 * кредитом, оплатой или бесплатно). Месячная квота тарифа считалась по
 * published_at, а у объявления на модерации его нет: пока модерация не
 * прошла, квота не уменьшалась, и можно было разместить бесплатно больше,
 * чем даёт тариф.
 *
 * Действующим Владельцам и модераторам — умолчания их ролей: подписка не
 * требуется, размещений без ограничения. Так они не теряют того, что роль
 * давала им до сих пор.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('subscription_exempt')->default(false)->after('role');
            $table->unsignedInteger('free_listings_quota')->default(0)->after('listing_placement_credits');
            $table->boolean('free_listings_unlimited')->default(false)->after('free_listings_quota');
            $table->unsignedInteger('free_listings_used')->default(0)->after('free_listings_unlimited');
        });

        Schema::table('listings', function (Blueprint $table): void {
            $table->string('placement_free_reason', 32)->nullable()->after('placement_was_free');
            $table->timestamp('placement_covered_at')->nullable()->after('placement_free_reason');
        });

        DB::table('users')
            ->whereIn('role', ['owner', 'moderator'])
            ->update(['subscription_exempt' => true, 'free_listings_unlimited' => true]);
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn(['placement_free_reason', 'placement_covered_at']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['subscription_exempt', 'free_listings_quota', 'free_listings_unlimited', 'free_listings_used']);
        });
    }
};
