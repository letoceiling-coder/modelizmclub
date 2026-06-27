<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL does not auto-create indexes on foreign-key columns. These three
 * columns are filtered/joined on hot paths (category feed, per-user comment and
 * message lookups, and the simulator's per-user cleanup) but were left without a
 * covering index, forcing sequential scans as the tables grow.
 *
 * posts.user_id is already covered by the composite (user_id, status) index, so
 * it is intentionally omitted here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->index('category_id', 'posts_category_id_index');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->index('user_id', 'comments_user_id_index');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->index('user_id', 'messages_user_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex('posts_category_id_index');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex('comments_user_id_index');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_user_id_index');
        });
    }
};
