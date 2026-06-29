<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('session_id', 64)->nullable();
            $table->string('call_uuid', 64)->nullable();
            $table->string('platform', 32)->nullable();   // Android | iOS | Windows | macOS | Linux
            $table->string('os', 64)->nullable();
            $table->string('browser', 64)->nullable();
            $table->string('device', 64)->nullable();      // mobile | tablet | desktop
            $table->string('network', 32)->nullable();     // effectiveType: 4g | wifi | ...
            $table->text('user_agent')->nullable();
            $table->string('level', 16)->default('info');  // debug | info | warn | error
            $table->string('tag', 32)->default('app');
            $table->text('message')->nullable();
            $table->json('context')->nullable();
            $table->timestamp('client_time')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['call_uuid']);
            $table->index(['session_id']);
            $table->index(['level', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_logs');
    }
};
