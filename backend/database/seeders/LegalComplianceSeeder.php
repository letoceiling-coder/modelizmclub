<?php

namespace Database\Seeders;

use App\Enums\LegalPageStatus;
use App\Models\FooterLink;
use App\Models\LegalPage;
use App\Models\SystemSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class LegalComplianceSeeder extends Seeder
{
    /** @var array<string, string> */
    private const PAGES = [
        'rules' => 'Пользовательское соглашение',
        'privacy' => 'Политика конфиденциальности',
        'consent' => 'Согласие на обработку персональных данных',
        'compliance' => 'Кодекс этики и правила сообщества',
        'payment' => 'Оплата',
        'refund' => 'Возврат денежных средств',
        'how-it-works' => 'Как работает платформа',
        'safe-deal' => 'Правила безопасной сделки',
    ];

    public function run(): void
    {
        $dataDir = database_path('seeders/data/legal');

        foreach (self::PAGES as $slug => $title) {
            $htmlPath = $dataDir.DIRECTORY_SEPARATOR.$slug.'.html';
            $content = File::exists($htmlPath) ? File::get($htmlPath) : '<p>Документ готовится.</p>';

            $attrs = [
                'title' => $title,
                'content_html' => $content,
                'status' => LegalPageStatus::Published,
                'version' => 1,
                'published_at' => now(),
            ];
            $meta = 'Регламент услуги «Безопасная сделка» ООО «МОДЕЛИЗМ»: холдирование оплаты, доставка СДЭК, подтверждение получения и споры.';
            $hasMeta = Schema::hasColumn('legal_pages', 'meta_description');
            if ($slug === 'safe-deal' && $hasMeta) {
                $attrs['meta_description'] = $meta;
            }

            $page = LegalPage::query()->firstOrCreate(
                ['slug' => $slug],
                $attrs,
            );
            if ($slug === 'safe-deal' && $hasMeta && blank($page->meta_description)) {
                $page->update(['meta_description' => $meta]);
            }
        }

        $this->seedInfoPages();
        $this->seedLegalRequisites();

        $links = [
            ['group' => 'legal', 'label' => 'Пользовательское соглашение', 'target_type' => 'internal', 'target_value' => '/legal/rules', 'sort' => 10],
            ['group' => 'legal', 'label' => 'Политика конфиденциальности', 'target_type' => 'internal', 'target_value' => '/legal/privacy', 'sort' => 20],
            ['group' => 'legal', 'label' => 'Согласие на обработку ПД', 'target_type' => 'internal', 'target_value' => '/legal/consent', 'sort' => 30],
            ['group' => 'legal', 'label' => 'Кодекс этики', 'target_type' => 'internal', 'target_value' => '/legal/compliance', 'sort' => 40],
            ['group' => 'legal', 'label' => 'Оплата', 'target_type' => 'internal', 'target_value' => '/payment', 'sort' => 50],
            ['group' => 'legal', 'label' => 'Безопасная сделка', 'target_type' => 'internal', 'target_value' => '/safe-deal', 'sort' => 55],
            ['group' => 'legal', 'label' => 'Возврат', 'target_type' => 'internal', 'target_value' => '/refund', 'sort' => 60],
            ['group' => 'info', 'label' => 'Обратная связь', 'target_type' => 'internal', 'target_value' => '/info/feedback', 'sort' => 10],
            ['group' => 'info', 'label' => 'Безопасность', 'target_type' => 'internal', 'target_value' => '/info/security', 'sort' => 20],
            ['group' => 'info', 'label' => 'Как это работает', 'target_type' => 'internal', 'target_value' => '/how-it-works', 'sort' => 30],
        ];

        foreach ($links as $link) {
            FooterLink::query()->firstOrCreate(
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

    private function seedInfoPages(): void
    {
        $pages = [
            'about' => ['О нас', 'МоДелизМ — маркетплейс, лента и сообщество для моделистов России. Мы объединяем тех, кто строит, летает и гоняет.'],
            'company' => ['О компании', 'Юридическая и организационная информация о проекте МоДелизМ.'],
            'partners' => ['Партнёрам', 'Сотрудничество с магазинами, брендами и клубами. Совместные акции, витрины и каналы для брендов моделизма.'],
            'advertising' => ['Размещение рекламы', 'Форматы продвижения на платформе: баннеры, продвинутые объявления и брендовые каналы.'],
            'support' => ['Служба поддержки', 'Мы на связи каждый день с 10:00 до 20:00 МСК. Напишите нам — поможем с аккаунтом, объявлением или сделкой.'],
            'feedback' => ['Обратная связь', 'Ваши идеи и замечания делают платформу лучше. Оставьте отзыв или сообщите о проблеме.'],
            'contacts' => ['Контакты', 'Свяжитесь с нами через форму обратной связи или контакты в подвале сайта.'],
            'security' => ['Безопасность', 'Принципы безопасной сделки, модерация объявлений и защита персональных данных на платформе МоДелизМ.'],
        ];

        foreach ($pages as $slug => [$title, $text]) {
            LegalPage::query()->firstOrCreate(
                ['slug' => $slug],
                [
                    'title' => $title,
                    'content_html' => '<p>'.e($text).'</p>',
                    'status' => LegalPageStatus::Published,
                    'version' => 1,
                    'published_at' => now(),
                ],
            );
        }
    }

    private function seedLegalRequisites(): void
    {
        $defaults = [
            'legal_name' => 'ООО «МОДЕЛИЗМ»',
            'inn' => '2312341754',
            'ogrn' => '1262300020751',
            'address' => '350000 г. Краснодар, ул. Симферопольская 56-112',
        ];

        $setting = SystemSetting::query()->where('key', 'footer.contacts')->first();
        if ($setting === null) {
            SystemSetting::query()->create([
                'key' => 'footer.contacts',
                'group' => 'footer',
                'value' => $defaults,
            ]);

            return;
        }

        $value = is_array($setting->value) ? $setting->value : [];
        $changed = false;
        foreach ($defaults as $key => $default) {
            if (! isset($value[$key]) || ! is_string($value[$key]) || trim($value[$key]) === '') {
                $value[$key] = $default;
                $changed = true;
            }
        }
        if ($changed) {
            $setting->update(['value' => $value]);
        }
    }
}
