<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channel_applications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('proposed_name');
            $table->text('description')->nullable();
            $table->string('category')->nullable();
            $table->string('status', 32)->default('pending');
            $table->text('moderator_comment')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('icon_assets', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->text('svg');
            $table->string('source', 32)->default('upload');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('icon_assets');
        Schema::dropIfExists('channel_applications');
    }
};
