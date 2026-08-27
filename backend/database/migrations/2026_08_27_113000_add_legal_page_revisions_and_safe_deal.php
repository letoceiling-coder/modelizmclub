<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('legal_pages', function (Blueprint $table): void {
            $table->longText('content_md')->nullable()->after('content_html');
            $table->string('meta_description', 320)->nullable()->after('title');
        });

        Schema::create('legal_page_revisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('legal_page_id')->constrained('legal_pages')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('title');
            $table->string('meta_description', 320)->nullable();
            $table->longText('content_html');
            $table->longText('content_md')->nullable();
            $table->string('status', 16);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['legal_page_id', 'version']);
        });

        $htmlPath = database_path('seeders/data/legal/safe-deal.html');
        $html = File::exists($htmlPath) ? File::get($htmlPath) : '<p>Документ готовится.</p>';
        $meta = 'Регламент услуги «Безопасная сделка» ООО «МОДЕЛИЗМ»: холдирование оплаты, доставка СДЭК, подтверждение получения и споры.';

        if (! DB::table('legal_pages')->where('slug', 'safe-deal')->exists()) {
            DB::table('legal_pages')->insert([
                'slug' => 'safe-deal',
                'title' => 'Правила безопасной сделки',
                'meta_description' => $meta,
                'content_html' => $html,
                'content_md' => null,
                'status' => 'published',
                'version' => 1,
                'published_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! DB::table('footer_links')->where('target_value', '/safe-deal')->exists()) {
            DB::table('footer_links')->insert([
                'group' => 'legal',
                'label' => 'Безопасная сделка',
                'target_type' => 'internal',
                'target_value' => '/safe-deal',
                'sort' => 55,
                'is_visible' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('footer_links')->where('target_value', '/safe-deal')->delete();
        DB::table('legal_pages')->where('slug', 'safe-deal')->delete();
        Schema::dropIfExists('legal_page_revisions');
        Schema::table('legal_pages', function (Blueprint $table): void {
            $table->dropColumn(['content_md', 'meta_description']);
        });
    }
};
