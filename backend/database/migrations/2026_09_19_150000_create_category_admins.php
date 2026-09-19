<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Администраторы направлений (решение 19.09).
 *
 * category_admins — кто отвечает за какое направление. Направления — из
 * существующего дерева (post_categories); права распространяются на ветку
 * целиком, вместе с подкатегориями и зеркальными категориями объявлений
 * (App\Support\CategoryScope). Сколько администраторов может быть у одного
 * направления — настройка `category_admins.max_per_category`, по умолчанию
 * 10 (Modules\Admin\Services\CategoryAdminService).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('category_admins', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('post_category_id')->constrained('post_categories')->cascadeOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'post_category_id']);
            $table->index('post_category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('category_admins');
    }
};
