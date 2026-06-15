<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->nullable();
            $table->string('email')->unique()->nullable();
            $table->string('phone', 20)->unique()->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('role', 32)->default('user');
            $table->string('status', 32)->default('pending_verification');
            $table->string('registration_track', 32)->nullable();
            $table->string('locale', 5)->default('ru');
            $table->timestamp('last_seen_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['role', 'status']);
        });

        Schema::create('email_verification_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code', 6);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'code']);
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_verification_codes');
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
