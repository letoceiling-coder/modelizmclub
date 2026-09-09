<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Состояние товара — «новое» или «б/у».
 *
 * Поле спрашивали у продавца с самого начала: в форме подачи стоит выбор из
 * двух значений, предпросмотр показывает выбранное, карточка каталога умеет
 * его рисовать, а в «Моих объявлениях» по нему есть фильтр и быстрые чипсы.
 * Не было только колонки: `createListing` это значение не отправлял, и оно
 * пропадало между предпросмотром и сохранением. Подсказка под полем —
 * «опишите состояние в описании» — обходила ровно эту дыру.
 *
 * Существующие строки остаются с NULL: угадывать за продавца, новое у него
 * или б/у, нельзя, а «не указано» карточка просто не рисует.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->string('condition', 8)->nullable()->after('price_cents');
        });
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn('condition');
        });
    }
};
