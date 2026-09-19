<?php

namespace Modules\Admin\Services;

use App\Enums\UserRole;
use App\Models\PostCategory;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Назначение администраторов направлений (решение 19.09).
 *
 * Направления — узлы дерева post_categories; права администратора
 * распространяются на ветку целиком (App\Support\CategoryScope). У одного
 * направления не больше `category_admins.max_per_category` администраторов,
 * по умолчанию 10: Владелец меняет число в настройках.
 */
class CategoryAdminService
{
    public const SETTING_KEY = 'category_admins.max_per_category';

    public const DEFAULT_MAX_PER_CATEGORY = 10;

    public static function maxPerCategory(): int
    {
        $value = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $max = is_array($value) ? ($value['value'] ?? null) : $value;

        return is_numeric($max) && (int) $max >= 1 ? (int) $max : self::DEFAULT_MAX_PER_CATEGORY;
    }

    /** @return list<array{id: int, name: string, slug: string, admins_count: int}> */
    public function categoriesOf(User $user): array
    {
        return PostCategory::query()
            ->join('category_admins', 'category_admins.post_category_id', '=', 'post_categories.id')
            ->where('category_admins.user_id', $user->id)
            ->orderBy('post_categories.name')
            ->get(['post_categories.id', 'post_categories.name', 'post_categories.slug'])
            ->map(fn (PostCategory $c) => [
                'id' => (int) $c->id,
                'name' => (string) $c->name,
                'slug' => (string) $c->slug,
                'admins_count' => $this->adminsCount((int) $c->id),
            ])
            ->all();
    }

    /**
     * Заменить направления человека на переданный список.
     *
     * @param  list<int>  $categoryIds
     * @return array{added: list<int>, removed: list<int>}
     */
    public function sync(User $target, array $categoryIds, User $actor): array
    {
        $categoryIds = array_values(array_unique(array_map('intval', $categoryIds)));

        if ($categoryIds !== [] && $target->role !== UserRole::CategoryAdmin) {
            throw ValidationException::withMessages([
                'category_ids' => ['Направления назначаются администратору направления — сначала смените роль.'],
            ]);
        }

        $known = PostCategory::query()->whereIn('id', $categoryIds)->pluck('name', 'id');
        $missing = array_diff($categoryIds, $known->keys()->map(fn ($id) => (int) $id)->all());
        if ($missing !== []) {
            throw ValidationException::withMessages([
                'category_ids' => ['Направление не найдено: '.implode(', ', $missing).'.'],
            ]);
        }

        return DB::transaction(function () use ($target, $categoryIds, $actor, $known): array {
            // Направления под замком: два одновременных назначения не должны
            // вместе перешагнуть предел.
            PostCategory::query()->whereIn('id', $categoryIds)->lockForUpdate()->get(['id']);

            $current = DB::table('category_admins')->where('user_id', $target->id)->pluck('post_category_id')
                ->map(fn ($id) => (int) $id)->all();
            $added = array_values(array_diff($categoryIds, $current));
            $removed = array_values(array_diff($current, $categoryIds));

            $max = self::maxPerCategory();
            foreach ($added as $id) {
                if ($this->adminsCount($id) >= $max) {
                    throw ValidationException::withMessages([
                        'category_ids' => ["У направления «{$known[$id]}» уже {$max} администраторов — это предел."],
                    ]);
                }
            }

            DB::table('category_admins')->where('user_id', $target->id)->whereIn('post_category_id', $removed)->delete();
            foreach ($added as $id) {
                DB::table('category_admins')->insert([
                    'user_id' => $target->id,
                    'post_category_id' => $id,
                    'assigned_by' => $actor->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return ['added' => $added, 'removed' => $removed];
        });
    }

    private function adminsCount(int $categoryId): int
    {
        return DB::table('category_admins')->where('post_category_id', $categoryId)->count();
    }
}
