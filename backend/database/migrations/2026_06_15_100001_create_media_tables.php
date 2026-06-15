<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('disk', 32)->default('s3');
            $table->string('path');
            $table->string('filename');
            $table->string('mime_type', 127);
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('hash', 64)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('pending');
            $table->json('variants')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['uploaded_by', 'status']);
        });

        Schema::create('media_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->string('attachable_type');
            $table->unsignedBigInteger('attachable_id');
            $table->string('collection', 64)->default('default');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['attachable_type', 'attachable_id']);
            $table->unique(['media_id', 'attachable_type', 'attachable_id', 'collection'], 'media_attachments_unique');
        });

        Schema::create('upload_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('purpose', 32);
            $table->unsignedTinyInteger('max_files')->default(10);
            $table->unsignedInteger('max_size_bytes')->default(10485760);
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('upload_sessions');
        Schema::dropIfExists('media_attachments');
        Schema::dropIfExists('media');
    }
};
