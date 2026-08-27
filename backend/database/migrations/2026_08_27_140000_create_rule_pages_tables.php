<?php

use Database\Seeders\RulesHubSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rule_pages', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 64)->unique();
            $table->string('title');
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 320)->nullable();
            $table->string('summary', 500)->nullable();
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'sort']);
        });

        Schema::create('rule_page_sections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rule_page_id')->constrained('rule_pages')->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('title')->nullable();
            $table->longText('content');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_visible')->default(true);
            $table->timestamps();

            $table->index(['rule_page_id', 'position']);
        });

        Schema::create('rule_page_revisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rule_page_id')->constrained('rule_pages')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('title');
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 320)->nullable();
            $table->string('summary', 500)->nullable();
            $table->string('status', 16);
            $table->json('content_snapshot');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['rule_page_id', 'version']);
        });

        if (Schema::hasTable('footer_links')) {
            $existingSafeDeal = DB::table('footer_links')->where('target_value', '/rules/safe-deal')->exists();
            if ($existingSafeDeal) {
                DB::table('footer_links')->where('target_value', '/safe-deal')->delete();
            } else {
                DB::table('footer_links')->where('target_value', '/safe-deal')->update([
                    'target_value' => '/rules/safe-deal',
                    'label' => 'Безопасная сделка',
                ]);
            }

            if (! DB::table('footer_links')->where('target_value', '/rules')->exists()) {
                DB::table('footer_links')->insert([
                    'group' => 'legal',
                    'label' => 'Правила',
                    'target_type' => 'internal',
                    'target_value' => '/rules',
                    'sort' => 5,
                    'is_visible' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        (new RulesHubSeeder())->run();
    }

    public function down(): void
    {
        Schema::dropIfExists('rule_page_revisions');
        Schema::dropIfExists('rule_page_sections');
        Schema::dropIfExists('rule_pages');

        if (Schema::hasTable('footer_links')) {
            DB::table('footer_links')->where('target_value', '/rules')->delete();
            DB::table('footer_links')->where('target_value', '/rules/safe-deal')->update([
                'target_value' => '/safe-deal',
            ]);
        }
    }
};
