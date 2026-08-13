<?php

namespace Database\Seeders;

use App\Enums\LegalPageStatus;
use App\Models\FooterLink;
use App\Models\LegalPage;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class LegalComplianceSeeder extends Seeder
{
    /** @var array<string, string> */
    private const PAGES = [
        'rules' => 'Пользовательское соглашение',
        'privacy' => 'Политика конфиденциальности',
        'consent' => 'Согласие на обработку персональных данных',
        'compliance' => 'Кодекс этики и правила сообщества',
    ];

    public function run(): void
    {
        $dataDir = database_path('seeders/data/legal');

        foreach (self::PAGES as $slug => $title) {
            $htmlPath = $dataDir.DIRECTORY_SEPARATOR.$slug.'.html';
            $content = File::exists($htmlPath) ? File::get($htmlPath) : '<p>Документ готовится.</p>';

            LegalPage::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'title' => $title,
                    'content_html' => $content,
                    'status' => LegalPageStatus::Published,
                    'version' => 1,
                    'published_at' => now(),
                ],
            );
        }

        $links = [
            ['group' => 'legal', 'label' => 'Пользовательское соглашение', 'target_type' => 'internal', 'target_value' => '/legal/rules', 'sort' => 10],
            ['group' => 'legal', 'label' => 'Политика конфиденциальности', 'target_type' => 'internal', 'target_value' => '/legal/privacy', 'sort' => 20],
            ['group' => 'legal', 'label' => 'Согласие на обработку ПД', 'target_type' => 'internal', 'target_value' => '/legal/consent', 'sort' => 30],
            ['group' => 'legal', 'label' => 'Кодекс этики', 'target_type' => 'internal', 'target_value' => '/legal/compliance', 'sort' => 40],
            ['group' => 'info', 'label' => 'Обратная связь', 'target_type' => 'internal', 'target_value' => '/info/feedback', 'sort' => 10],
            ['group' => 'info', 'label' => 'Безопасность', 'target_type' => 'internal', 'target_value' => '/info/security', 'sort' => 20],
        ];

        foreach ($links as $link) {
            FooterLink::query()->updateOrCreate(
                [
                    'group' => $link['group'],
                    'target_value' => $link['target_value'],
                ],
                [
                    'label' => $link['label'],
                    'target_type' => $link['target_type'],
                    'sort' => $link['sort'],
                    'is_visible' => true,
                ],
            );
        }
    }
}
