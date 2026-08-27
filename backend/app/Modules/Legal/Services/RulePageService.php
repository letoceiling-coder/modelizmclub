<?php

namespace Modules\Legal\Services;

use App\Enums\LegalPageStatus;
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
            ];
        });
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
