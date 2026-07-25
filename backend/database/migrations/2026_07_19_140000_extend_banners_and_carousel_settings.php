<?php

use App\Models\Banner;
use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table): void {
            $table->unsignedSmallInteger('priority')->default(0)->after('is_active');
            $table->boolean('is_pinned')->default(false)->after('priority');
            $table->string('cta_text', 100)->default('Подробнее')->after('text');
            $table->string('kind', 16)->nullable()->after('cta_text');
            $table->string('until_label', 64)->nullable()->after('kind');
            $table->unsignedInteger('sort_order')->default(0)->after('until_label');
        });

        SystemSetting::query()->updateOrCreate(
            ['key' => 'banners.carousel'],
            [
                'value' => [
                    'enabled' => true,
                    'placement' => 'events',
                    'autoplay_seconds' => 10,
                    'max_slides' => 5,
                ],
                'group' => 'advertising',
            ],
        );

        if (Banner::query()->where('placement', 'events')->where('is_active', true)->doesntExist()) {
            $defaults = [
                [
                    'title' => 'Открытие сезона судомоделей',
                    'text' => 'Запуски на открытой воде, регата и обмен опытом. Приводите свои модели и друзей.',
                    'link_url' => '/communities',
                    'kind' => 'event',
                    'until_label' => 'до 15 авг',
                    'sort_order' => 1,
                    'priority' => 10,
                ],
                [
                    'title' => 'Выставка масштабных моделей',
                    'text' => 'Лучшие сборки сезона, мастер-классы по покраске и встреча с экспертами сообщества.',
                    'link_url' => '/feed',
                    'kind' => 'news',
                    'until_label' => 'до 30 авг',
                    'sort_order' => 2,
                    'priority' => 5,
                ],
                [
                    'title' => 'Чемпионат по дрэг-рейсингу RC',
                    'text' => 'Финал сезона уже в эту субботу. Болельщики, пилоты и swap-зона запчастей ждут вас на трассе.',
                    'link_url' => '/communities',
                    'kind' => 'promo',
                    'until_label' => 'до 20 авг',
                    'sort_order' => 3,
                    'priority' => 0,
                ],
            ];

            foreach ($defaults as $row) {
                Banner::query()->create([
                    'placement' => 'events',
                    'is_active' => true,
                    'starts_at' => now()->subDay(),
                    'ends_at' => now()->addMonths(3),
                    ...$row,
                ]);
            }
        }

        // Legacy Swagger/demo rows used feed_top — map them to the feed carousel slot.
        Banner::query()->where('placement', 'feed_top')->update(['placement' => 'feed']);
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table): void {
            $table->dropColumn(['priority', 'is_pinned', 'cta_text', 'kind', 'until_label', 'sort_order']);
        });

        SystemSetting::query()->where('key', 'banners.carousel')->delete();
    }
};
