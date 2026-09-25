<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Признак учётной записи приёмки.
 *
 * Прежние три опознавались по имени — «ТЕСТ БЕЗ СМС» и подобным. Имя
 * затирается при обезличивании, а 25.09 их и обезличили: после этого
 * проверять «без SMS / с SMS / с подпиской» стало нечем, и восстановить
 * было не по чему — в базе не осталось ничего, что отличало бы их от
 * обычных заблокированных.
 *
 * Колонка живёт отдельно от имени и от почты: её не затирает ни
 * обезличивание, ни смена адреса, ни переименование. По ней же
 * `users:anonymize` отказывается трогать такую учётку без явного
 * `--force` — чтобы следующая уборка не повторила ту же потерю.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_qa_account')->default(false)->after('status');
            $table->index('is_qa_account');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['is_qa_account']);
            $table->dropColumn('is_qa_account');
        });
    }
};
