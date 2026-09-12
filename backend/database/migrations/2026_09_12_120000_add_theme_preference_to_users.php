<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Тема оформления — рядом с `locale`, а не только в браузере.
 *
 * До 12.09 выбор жил исключительно в `localStorage`: на втором устройстве
 * человек снова получал системную тему. Колонка нужна именно как «что выбрал
 * пользователь», поэтому три значения — `light`, `dark`, `system`, — и `null`
 * означает «не выбирал ни разу».
 *
 * Первый кадр по-прежнему красит скрипт из `localStorage`: серверного знания
 * о зрителе при отрисовке нет, и ждать ответа ради темы значило бы моргать.
 * Серверное значение применяется только там, где местного ещё нет, — то есть
 * на новом устройстве.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('theme_preference', 16)->nullable()->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('theme_preference');
        });
    }
};
