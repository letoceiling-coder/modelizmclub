<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->foreignId('listing_id')->nullable()->after('community_id')->constrained()->nullOnDelete();
            $table->foreignId('pinned_message_id')->nullable()->after('last_message_at')->constrained('messages')->nullOnDelete();
        });

        Schema::table('conversation_participants', function (Blueprint $table): void {
            $table->timestamp('pinned_at')->nullable()->after('muted_until');
        });

        Schema::table('messages', function (Blueprint $table): void {
            $table->foreignId('forwarded_from_message_id')->nullable()->after('reply_to_id')->constrained('messages')->nullOnDelete();
        });

        Schema::create('message_user_hides', function (Blueprint $table): void {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->timestamp('hidden_at')->useCurrent();

            $table->primary(['user_id', 'message_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_user_hides');

        Schema::table('messages', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('forwarded_from_message_id');
        });

        Schema::table('conversation_participants', function (Blueprint $table): void {
            $table->dropColumn('pinned_at');
        });

        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('pinned_message_id');
            $table->dropConstrainedForeignId('listing_id');
        });
    }
};
