<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_first_hundred')->default(false)->after('referred_by');
            $table->timestamp('first_hundred_granted_at')->nullable()->after('is_first_hundred');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['is_first_hundred', 'first_hundred_granted_at']);
        });
    }
};
