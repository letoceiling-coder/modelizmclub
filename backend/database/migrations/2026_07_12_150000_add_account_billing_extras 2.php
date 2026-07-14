<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('listing_placement_credits')->default(0)->after('locale');
        });

        Schema::create('user_two_factor', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->text('secret');
            $table->boolean('enabled')->default(false);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_two_factor');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('listing_placement_credits');
        });
    }
};
