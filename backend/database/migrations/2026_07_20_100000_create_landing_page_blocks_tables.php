<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_sections', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 32)->unique();
            $table->string('eyebrow', 120)->nullable();
            $table->string('title', 200);
            $table->text('subtitle')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('landing_cards', function (Blueprint $table): void {
            $table->id();
            $table->string('section_slug', 32);
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('icon', 64)->default('Box');
            $table->string('link_url', 500)->nullable();
            $table->foreignId('post_category_id')->nullable()->constrained('post_categories')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['section_slug', 'is_active', 'sort_order']);
        });

        (new \Database\Seeders\LandingPageSeeder())->run();
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_cards');
        Schema::dropIfExists('landing_sections');
    }
};
