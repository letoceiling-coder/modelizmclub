<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ответ на обращение в «Книгу жалоб и предложений».
 *
 * До этой миграции обращение было улицей с односторонним движением: человек
 * писал, админка показывала письмо и позволяла переключить метку
 * «новое / прочитано / решено» — и всё. Метка видна только сотрудникам;
 * отправитель не узнавал ни что его прочитали, ни чем кончилось. На проде
 * так и лежат пять обращений, два из них помечены «решено», и ни одному
 * человеку никто не ответил.
 *
 * Ответ хранится в самой строке обращения, а не в переписке: у обращения
 * один ответ, и заводить ради него отдельную таблицу значило бы обещать
 * диалог, которого в админке нет.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedback', function (Blueprint $table): void {
            $table->text('reply')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->foreignId('replied_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('feedback', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('replied_by');
            $table->dropColumn(['reply', 'replied_at']);
        });
    }
};
