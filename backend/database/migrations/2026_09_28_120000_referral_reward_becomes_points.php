<?php

use App\Support\ReferralProgramConfig;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Награда за приглашение — бонусные баллы, и один телефон награждается раз.
 *
 * ЧТО ЗДЕСЬ ДВА РАЗНЫХ ДЕЛА, И ПОЧЕМУ ОНИ В ОДНОЙ МИГРАЦИИ. Первое —
 * перенос настроек акции на новую форму. Второе — таблица отметок о
 * выданных наградах. Порознь они бессмысленны: настройки без отметок
 * открывают накрутку, отметки без настроек никем не читаются.
 *
 * 1. НАСТРОЙКИ. Было: `per_invite`, `max_bonus`, `reward_kopecks`,
 *    `reward_listing_credits`, `reward_subscription_days`. Стало:
 *    `points_per_invite`, `max_paid_invites`, `terms`. Ключ `enabled`
 *    переносится как есть — выключенная акция остаётся выключенной.
 *
 *    `max_bonus` переезжает в `max_paid_invites` напрямую: при прежней
 *    награде «одна штука за друга» это было одно и то же число, и человек,
 *    поставивший там десятку, имел в виду десять друзей.
 *
 *    Награда деньгами не переносится никуда. Если на проде стоял ненулевой
 *    `reward_kopecks`, миграция об этом печатает: молча отменить начисление
 *    денег нельзя, про это должен узнать человек.
 *
 * 2. ОТМЕТКИ ПО ТЕЛЕФОНУ. Повторное начисление закрывали два замка:
 *    `referrals.invitee_id` уникален, и статус `completed` проверяется под
 *    блокировкой. Оба привязаны к учётной записи, а она удаляется — и
 *    `referrals` уходит вместе с ней каскадом. Значит «удалил учётку,
 *    зарегистрировался заново тем же телефоном» давало награду второй раз,
 *    и один телефон кормил бесконечно.
 *
 *    Отметка живёт отдельной таблицей без внешних ключей — она обязана
 *    пережить удаление обеих сторон. Хранится **хеш** телефона: сверять
 *    надо только равенство, а держать телефоны людей россыпью в служебной
 *    таблице незачем.
 *
 * ОТКАТ возвращает прежнюю форму настроек по умолчанию (величин уже нет —
 * они не сохраняются) и убирает таблицу отметок. Про это сказано вслух:
 * после отката накрутка снова открыта.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_phone_awards', function (Blueprint $table): void {
            $table->id();
            /*
             * sha256 от нормализованного телефона. Без внешнего ключа и без
             * ссылки на пользователя: строка переживает удаление учётки, в
             * этом весь смысл.
             */
            $table->string('phone_hash', 64)->unique();
            $table->timestamp('awarded_at');
        });

        /*
         * Сколько баллов принесло приглашение. Прежние `listing_credits` и
         * `subscription_days` остаются: в них записано, что человек получил
         * на самом деле, и переписывать историю в баллы значило бы соврать
         * про уже выданное.
         */
        Schema::table('referrals', function (Blueprint $table): void {
            if (! Schema::hasColumn('referrals', 'points')) {
                $table->unsignedInteger('points')->default(0)->after('status');
            }
        });

        $строка = DB::table('system_settings')
            ->where('key', ReferralProgramConfig::SETTING_KEY)
            ->value('value');

        $было = is_string($строка) ? json_decode($строка, true) : $строка;
        $было = is_array($было) ? $было : [];

        if ((int) ($было['reward_kopecks'] ?? 0) > 0) {
            $рубли = number_format(((int) $было['reward_kopecks']) / 100, 2, ',', ' ');
            echo "  рефералка: награда деньгами ({$рубли} ₽ за друга) больше не начисляется — теперь только баллы\n";
        }

        $стало = ReferralProgramConfig::normalize([
            'enabled' => $было['enabled'] ?? true,
            'points_per_invite' => ReferralProgramConfig::defaults()['points_per_invite'],
            // Прежний предел означал то же самое при награде «штука за друга».
            'max_paid_invites' => (int) ($было['max_bonus'] ?? 0),
            'terms' => ReferralProgramConfig::DEFAULT_TERMS,
        ]);

        DB::table('system_settings')->updateOrInsert(
            ['key' => ReferralProgramConfig::SETTING_KEY],
            [
                'value' => json_encode($стало, JSON_UNESCAPED_UNICODE),
                'group' => 'marketing',
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_phone_awards');

        Schema::table('referrals', function (Blueprint $table): void {
            if (Schema::hasColumn('referrals', 'points')) {
                $table->dropColumn('points');
            }
        });

        DB::table('system_settings')
            ->where('key', ReferralProgramConfig::SETTING_KEY)
            ->update([
                'value' => json_encode([
                    'enabled' => true,
                    'per_invite' => 1,
                    'max_bonus' => 10,
                    'reward_kopecks' => 0,
                    'reward_listing_credits' => true,
                    'reward_subscription_days' => 0,
                ], JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);

        echo "  рефералка: откат вернул прежнюю форму настроек; отметки по телефонам удалены, повторное начисление снова возможно\n";
    }
};
