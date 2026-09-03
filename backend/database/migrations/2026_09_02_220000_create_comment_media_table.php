<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comment_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['comment_id', 'media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_media');
    }
};
