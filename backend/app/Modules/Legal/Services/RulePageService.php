<?php

namespace Modules\Legal\Services;

use App\Enums\LegalPageStatus;
use App\Models\LegalPage;
use App\Models\RulePage;
use App\Models\RulePageRevision;
use App\Models\RulePageSection;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class RulePageService
{
    public const CACHE_HUB = 'rules.hub';

    public static function cachePageKey(string $slug): string
    {
        return 'rules.page.'.$slug;
    }

    public function forgetCache(?string $slug = null): void
    {
        Cache::forget(self::CACHE_HUB);
        if ($slug) {
            Cache::forget(self::cachePageKey($slug));
        }
    }

    /** @return array<string, mixed> */
    public function hubPayload(): array
    {
        return Cache::remember(self::CACHE_HUB, 300, function (): array {
            $pages = RulePage::query()
                ->where('status', LegalPageStatus::Published)
                ->orderBy('sort')
                ->orderBy('id')
                ->get();

            $latest = $pages
                ->map(fn (RulePage $page) => $page->published_at)
                ->filter()
                ->sort()
                ->last();

            return [
                'title' => 'Правила Моделизма',
                'intro' => 'Здесь собраны правила, по которым работает Моделизм. Пользуясь платформой, вы принимаете их условия. Рекомендуем периодически перечитывать эту страницу — правила могут обновляться.',
                'published_at' => $latest?->toIso8601String(),
                'documents' => $pages->map(fn (RulePage $page) => [
                    'slug' => $page->slug,
                    'title' => $page->title,
                    'summary' => $page->summary,
                    'published_at' => $page->published_at?->toIso8601String(),
                    'href' => '/rules/'.$page->slug,
                ])->all(),
                'groups' => $this->hubGroups($pages),
            ];
        });
    }

    /**
     * Хаб по смыслу, а не плоским списком.
     *
     * Раскладка нужна затем, что документов больше десятка и живут они в трёх
     * местах: `rule_pages` (блочные документы), `legal_pages` (сплошной текст)
     * и несколько отдельных маршрутов вроде `/payment`. Человеку, ищущему
     * порядок возврата, всё равно, в какой таблице он лежит.
     *
     * Отсутствующие документы показываются как «готовится», а не прячутся.
     * Пустая ссылка хуже отсутствующей: по ней человек уходит в 404 и решает,
     * что сайт сломан. Строка «готовится» говорит правду — документ нужен и
     * его пишут.
     *
     * Состав групп задан здесь, а не в базе, нарочно: это требование к
     * правовому разделу, а не настройка. Меняется он вместе с законом, то
     * есть правкой кода с обсуждением, а не кнопкой в админке. Содержимое
     * каждого документа при этом правится из админки без выкатки.
     *
     * @param  \Illuminate\Support\Collection<int, RulePage>  $rulePages
     * @return list<array<string, mixed>>
     */
    private function hubGroups($rulePages): array
    {
        $legal = LegalPage::query()
            ->where('status', LegalPageStatus::Published)
            ->get()
            ->keyBy('slug');

        $rules = $rulePages->keyBy('slug');

        $resolve = function (array $entry) use ($rules, $legal): array {
            $card = [
                'title' => $entry['title'],
                'summary' => $entry['summary'] ?? null,
                'href' => null,
                'published_at' => null,
                'state' => 'planned',
            ];

            if (($entry['kind'] ?? null) === 'route') {
                $card['href'] = $entry['href'];
                $card['state'] = 'ready';

                if (isset($entry['legal_slug']) && $legal->has($entry['legal_slug'])) {
                    $card['published_at'] = $legal[$entry['legal_slug']]->published_at?->toIso8601String();
                }

                return $card;
            }

            if (isset($entry['rule_slug']) && $rules->has($entry['rule_slug'])) {
                $page = $rules[$entry['rule_slug']];
                $card['href'] = '/rules/'.$page->slug;
                $card['summary'] = $card['summary'] ?? $page->summary;
                $card['published_at'] = $page->published_at?->toIso8601String();
                $card['state'] = 'ready';

                return $card;
            }

            if (isset($entry['legal_slug']) && $legal->has($entry['legal_slug'])) {
                $page = $legal[$entry['legal_slug']];
                $card['href'] = '/legal/'.$page->slug;
                $card['published_at'] = $page->published_at?->toIso8601String();
                $card['state'] = 'ready';

                return $card;
            }

            return $card;
        };

        $groups = [
            [
                'key' => 'money',
                'title' => 'Деньги и услуги',
                'description' => 'Сколько стоят платные услуги, как их оплатить и вернуть деньги.',
                'items' => [
                    ['title' => 'Тарифы и стоимость услуг', 'kind' => 'route', 'href' => '/rules/tariffs', 'summary' => 'Подписка, размещение, продвижение, комиссия сделки — цены в рублях.'],
                    ['title' => 'Оферта на платные услуги', 'rule_slug' => 'services-offer'],
                    ['title' => 'Оплата', 'kind' => 'route', 'href' => '/payment', 'legal_slug' => 'payment', 'summary' => 'Способы оплаты и момент списания.'],
                    ['title' => 'Возврат денежных средств', 'kind' => 'route', 'href' => '/refund', 'legal_slug' => 'refund', 'summary' => 'Когда и как возвращаются деньги.'],
                    ['title' => 'Безопасная сделка', 'rule_slug' => 'safe-deal'],
                ],
            ],
            [
                'key' => 'platform',
                'title' => 'Правила площадки',
                'description' => 'Что можно размещать, как проходит проверка и что делать при споре.',
                'items' => [
                    ['title' => 'Условия пользования', 'rule_slug' => 'terms'],
                    ['title' => 'Правила размещения объявлений', 'rule_slug' => 'ads'],
                    ['title' => 'Пользовательское соглашение', 'legal_slug' => 'rules'],
                    ['title' => 'Кодекс этики и правила сообщества', 'legal_slug' => 'compliance'],
                ],
            ],
            [
                'key' => 'privacy',
                'title' => 'Данные и приватность',
                'description' => 'Что мы собираем, зачем и как это отозвать.',
                'items' => [
                    ['title' => 'Политика конфиденциальности', 'legal_slug' => 'privacy'],
                    ['title' => 'Согласие на обработку персональных данных', 'legal_slug' => 'consent'],
                    ['title' => 'Использование cookie', 'legal_slug' => 'cookies'],
                ],
            ],
            [
                'key' => 'about',
                'title' => 'О сервисе',
                'description' => 'Как это работает и с кем вы имеете дело.',
                'items' => [
                    ['title' => 'Как работает платформа', 'kind' => 'route', 'href' => '/how-it-works', 'legal_slug' => 'how-it-works'],
                    ['title' => 'Реквизиты и контакты', 'legal_slug' => 'contacts'],
                    ['title' => 'Служба поддержки', 'legal_slug' => 'support'],
                    ['title' => 'Обратная связь', 'legal_slug' => 'feedback'],
                ],
            ],
        ];

        return array_map(static function (array $group) use ($resolve): array {
            $group['items'] = array_map($resolve, $group['items']);

            return $group;
        }, $groups);
    }

    /** @return array<string, mixed>|null */
    public function publicBySlug(string $slug): ?array
    {
        $key = self::cachePageKey($slug);
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached;
        }

        $page = RulePage::query()
            ->where('slug', $slug)
            ->where('status', LegalPageStatus::Published)
            ->first();
        if (! $page) {
            return null;
        }

        $payload = $this->publicPayload($page);
        Cache::put($key, $payload, 300);

        return $payload;
    }

    public function publish(RulePage $page, ?User $user): RulePage
    {
        return DB::transaction(function () use ($page, $user): RulePage {
            $page->status = LegalPageStatus::Published;
            $page->published_at = now();
            if ($page->revisions()->exists()) {
                $page->version = $page->version + 1;
            }
            $page->save();
            $this->snapshot($page, $user);
            $this->forgetCache($page->slug);

            return $page->fresh(['sections']) ?? $page;
        });
    }

    public function duplicate(RulePage $page): RulePage
    {
        return DB::transaction(function () use ($page): RulePage {
            $page->loadMissing('sections');
            $base = $page->slug.'-copy';
            $slug = $base;
            $n = 2;
            while (RulePage::query()->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$n;
                $n++;
            }

            $copy = $page->replicate();
            $copy->slug = $slug;
            $copy->title = $page->title.' (копия)';
            $copy->status = LegalPageStatus::Draft;
            $copy->version = 1;
            $copy->published_at = null;
            $copy->save();

            foreach ($page->sections as $section) {
                $copy->sections()->create([
                    'type' => $section->type,
                    'title' => $section->title,
                    'content' => $section->content,
                    'position' => $section->position,
                    'is_visible' => $section->is_visible,
                ]);
            }

            return $copy->fresh(['sections']) ?? $copy;
        });
    }

    /** @return array<string, mixed> */
    public function publicPayload(RulePage $page): array
    {
        $page->loadMissing('sections');

        return [
            'slug' => $page->slug,
            'title' => $page->title,
            'seo_title' => $page->seo_title ?: $page->title,
            'seo_description' => $page->seo_description ?: $page->summary,
            'summary' => $page->summary,
            'version' => $page->version,
            'published_at' => $page->published_at?->toIso8601String(),
            'sections' => $page->sections
                ->filter(fn (RulePageSection $s) => $s->is_visible)
                ->values()
                ->map(fn (RulePageSection $s) => $this->sectionToArray($s))
                ->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function adminPayload(RulePage $page): array
    {
        $page->loadMissing('sections');

        return [
            'id' => $page->id,
            'slug' => $page->slug,
            'title' => $page->title,
            'seo_title' => $page->seo_title,
            'seo_description' => $page->seo_description,
            'summary' => $page->summary,
            'status' => $page->status->value,
            'version' => $page->version,
            'sort' => $page->sort,
            'published_at' => $page->published_at?->toIso8601String(),
            'updated_at' => $page->updated_at?->toIso8601String(),
            'sections' => $page->sections->map(fn (RulePageSection $s) => $this->sectionToArray($s, true))->all(),
        ];
    }

    public function snapshot(RulePage $page, ?User $user): RulePageRevision
    {
        $page->loadMissing('sections');

        return RulePageRevision::query()->create([
            'rule_page_id' => $page->id,
            'version' => $page->version,
            'title' => $page->title,
            'seo_title' => $page->seo_title,
            'seo_description' => $page->seo_description,
            'summary' => $page->summary,
            'status' => $page->status->value,
            'content_snapshot' => $page->sections->map(fn (RulePageSection $s) => $this->sectionToArray($s, true))->all(),
            'user_id' => $user?->id,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $sections
     */
    public function replaceSections(RulePage $page, array $sections): void
    {
        DB::transaction(function () use ($page, $sections): void {
            $page->sections()->delete();
            foreach (array_values($sections) as $i => $row) {
                $page->sections()->create([
                    'type' => $row['type'],
                    'title' => $row['title'] ?? null,
                    'content' => $row['content'] ?? '',
                    'position' => isset($row['position']) ? (int) $row['position'] : $i,
                    'is_visible' => array_key_exists('is_visible', $row) ? (bool) $row['is_visible'] : true,
                ]);
            }
        });
    }

    public function restore(RulePage $page, RulePageRevision $revision, ?User $user): RulePage
    {
        return DB::transaction(function () use ($page, $revision, $user): RulePage {
            $this->snapshot($page, $user);
            $page->fill([
                'title' => $revision->title,
                'seo_title' => $revision->seo_title,
                'seo_description' => $revision->seo_description,
                'summary' => $revision->summary,
            ]);
            $page->version = $page->version + 1;
            $page->status = LegalPageStatus::Draft;
            $page->published_at = null;
            $page->save();
            $this->replaceSections($page, is_array($revision->content_snapshot) ? $revision->content_snapshot : []);
            $this->forgetCache($page->slug);

            return $page->fresh(['sections']);
        });
    }

    /** @return array<string, mixed> */
    private function sectionToArray(RulePageSection $section, bool $admin = false): array
    {
        $data = [
            'type' => $section->type->value,
            'title' => $section->title,
            'content' => $section->content,
            'position' => $section->position,
        ];
        if ($admin) {
            $data['id'] = $section->id;
            $data['is_visible'] = $section->is_visible;
        }

        return $data;
    }
}
