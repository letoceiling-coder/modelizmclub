<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Отдельные права поверх роли: «этому модератору ещё и цены».
 *
 * Роль остаётся умолчанием, строка здесь — надстройка. Снять ею то, что
 * даёт роль, нельзя: строка только добавляет раздел. Поэтому у таблицы
 * нет колонки «разрешено/запрещено» — её наличие и есть разрешение, а
 * отзыв прав это удаление строки.
 *
 * `granted_by` — кто выдал. Аудит хранит событие, а эта колонка отвечает
 * на вопрос «кто это открыл» прямо в таблице, без поиска по журналу.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_permission_grants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('section', 64);
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'section']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_permission_grants');
    }
};
