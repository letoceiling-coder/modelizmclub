<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Тариф Pro скрыт и не покупается. Решение владельца от 04.10.
 *
 * Не удалён намеренно: удаление строки оборвало бы ссылки из подписок и
 * платежей, и прошлое перестало бы читаться. На 04.10 подписок на Pro ноль
 * и успешных платежей за него ноль, но это проверялось на боевой базе и
 * может измениться — удалять строку, от которой зависит история, нельзя
 * даже когда сегодня она ни на что не влияет.
 *
 * Отдельного признака «скрыт» не заводим: `is_active` уже делает ровно то,
 * что нужно, и в обоих местах сразу. Публичный список
 * (`IndexPlansController`) отбирает по нему, и создание платежа
 * (`CreatePaymentController`) тоже — прямой запрос с `plan_slug=pro`
 * получает «Тариф недоступен». Второй признак означал бы два места, где
 * решается один вопрос, и первое же расхождение между ними было бы дырой.
 *
 * В админке тариф остаётся виден: `AdminPlanController` перечисляет все
 * строки без отбора по `is_active`. Значит решение обратимо одним
 * переключателем, без выкатки.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('subscription_plans')->where('slug', 'pro')->update(['is_active' => false]);
    }

    public function down(): void
    {
        DB::table('subscription_plans')->where('slug', 'pro')->update(['is_active' => true]);
    }
};
