<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Категории идут по алфавиту — это новое умолчание.
 *
 * ЧТО МЕНЯЕТСЯ НА САЙТЕ. До этой выкатки дерево сортировалось по
 * `sort_order`, и алфавитом там не пахло: на проде верхний ряд шёл
 * «Ралли2 · Монеты · Авиация · Военные · Выставки · Инструмент ·
 * Исторические · Покраска · Распаковки · Роботы · Рыбалка · Weathering…».
 * После выкатки тот же ряд идёт А–Я, и это видно посетителю — в каталоге
 * объявлений, в ленте, в сообществах и в форме подачи.
 *
 * Строка заводится явно, а не оставляется пустой «раз умолчание всё
 * равно алфавит». Пустая строка значила бы «никто не выбирал», и первый
 * же разбор «почему каталог переставился» упёрся бы в отсутствие следа.
 * Здесь след есть: режим записан, дальше его меняет только человек
 * переключателем, и это попадает в аудит.
 *
 * Если строка уже есть — не трогаем: выкатка не должна отменять чужой
 * выбор.
 *
 * ОТКАТ возвращает ручной порядок. Номера `sort_order` никуда не
 * девались, так что дерево вернётся ровно в прежний вид.
 */
return new class extends Migration
{
    public function up(): void
    {
        $есть = DB::table('system_settings')->where('key', 'categories.sort_mode')->exists();

        if ($есть) {
            echo "  порядок категорий: выбор уже записан, не трогаем\n";

            return;
        }

        DB::table('system_settings')->insert([
            'key' => 'categories.sort_mode',
            'value' => json_encode(['mode' => 'alpha'], JSON_UNESCAPED_UNICODE),
            'group' => 'catalog',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        echo "  порядок категорий: по алфавиту А–Я (было — по номеру sort_order)\n";
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'categories.sort_mode')
            ->update([
                'value' => json_encode(['mode' => 'manual'], JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);

        echo "  порядок категорий: возвращён ручной\n";
    }
};
