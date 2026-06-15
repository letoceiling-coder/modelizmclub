<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('type', 32);
            $table->foreignId('community_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->index(['type', 'last_message_at']);
        });

        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32)->default('member');
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->foreignId('last_read_message_id')->nullable();
            $table->timestamp('muted_until')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body')->nullable();
            $table->string('type', 32)->default('text');
            $table->foreignId('reply_to_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->string('status', 32)->default('sent');
            $table->timestamp('edited_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['conversation_id', 'created_at']);
        });

        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('message_read_receipts', function (Blueprint $table) {
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('read_at');

            $table->primary(['message_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_read_receipts');
        Schema::dropIfExists('message_attachments');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
    }
};
