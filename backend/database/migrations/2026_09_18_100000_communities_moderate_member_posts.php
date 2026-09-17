<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * «Проверять записи участников» — решение владельца сообщества.
 *
 * По умолчанию включено: у существующих сообществ поведение для участников
 * не меняется. Записи владельца и модераторов сообщества проверки не ждут
 * в любом случае (PostService::needsModeration).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('communities', function (Blueprint $table): void {
            $table->boolean('moderate_member_posts')->default(true)->after('access_type');
        });
    }

    public function down(): void
    {
        Schema::table('communities', function (Blueprint $table): void {
            $table->dropColumn('moderate_member_posts');
        });
    }
};
