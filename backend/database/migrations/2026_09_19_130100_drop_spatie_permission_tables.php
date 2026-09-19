<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Таблицы spatie/laravel-permission сносятся вместе с пакетом (решение
 * 19.09; решение 17.09 — Spatie не доводить).
 *
 * На права они не влияли: роль только записывалась при регистрации, входе
 * через соцсети и сбросе пароля, а проверок по ней не было. Разрешений —
 * ноль. Зато у трёх сотрудников запись противоречила `users.role`
 * (Spatie `user` у Владельцев и модератора), и 45 человек не имели её вовсе.
 *
 * Почему снести, а не оставить пустыми: пустые таблицы при установленном
 * пакете выглядят как готовая система прав, и следующий, кто её увидит,
 * начнёт назначать в неё роли — получим две расходящиеся системы снова.
 * Без таблиц и без пакета возврат к Spatie — осознанное решение с
 * `composer require`, а не случайность. Права — по `users.role`.
 *
 * Строки в них — производные (14 записей «user» для случайных людей), их
 * потеря ничего не стоит. Откат восстанавливает пустые таблицы.
 */
return new class extends Migration
{
    private const TABLES = [
        'role_has_permissions',
        'model_has_roles',
        'model_has_permissions',
        'roles',
        'permissions',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
    }

    public function down(): void
    {
        $create = require database_path('migrations/2026_06_15_211523_create_permission_tables.php');
        $create->up();
    }
};
