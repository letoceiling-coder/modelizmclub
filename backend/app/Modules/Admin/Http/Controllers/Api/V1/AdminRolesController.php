<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\AdminAccess;
use App\Support\RolePrivileges;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Services\AuditService;
use Modules\Admin\Services\CategoryAdminService;

/**
 * Раздел «Роли и доступ» (решение 19.09): кто сотрудник, какие у него
 * льготы и направления, что открывает каждая роль. Только Владелец.
 *
 * Правки идут через существующие маршруты — роль и льготы через
 * PATCH /admin/users/{uuid}, направления через PUT /admin/users/{uuid}/
 * categories, кредиты через POST /admin/users/{uuid}/listing-credits.
 * Здесь — только сводка и предел администраторов на направление.
 */
#[Group('Admin — Roles', weight: 31)]
class AdminRolesController extends Controller
{
    private const STAFF_ROLES = [UserRole::Owner, UserRole::Moderator, UserRole::CategoryAdmin];

    #[Endpoint(title: 'Роли и доступ: сводка')]
    public function show(): JsonResponse
    {
        $staff = User::query()
            ->with('profile')
            ->whereIn('role', self::STAFF_ROLES)
            ->orderByRaw("case role when 'owner' then 0 when 'moderator' then 1 else 2 end")
            ->orderBy('id')
            ->get();

        $categories = DB::table('category_admins')
            ->join('post_categories', 'post_categories.id', '=', 'category_admins.post_category_id')
            ->whereIn('category_admins.user_id', $staff->pluck('id'))
            ->orderBy('post_categories.name')
            ->get(['category_admins.user_id', 'post_categories.id', 'post_categories.name', 'post_categories.slug'])
            ->groupBy('user_id');

        $roles = collect(UserRole::cases())->map(fn (UserRole $role) => [
            'role' => $role->value,
            'defaults' => RolePrivileges::defaultsFor($role),
            'sections' => array_keys(array_filter(
                AdminAccess::sectionLevels(),
                fn (string $min) => AdminAccess::rankOf($role) >= AdminAccess::rankOf($min),
            )),
        ])->all();

        return response()->json(['data' => [
            'staff' => $staff->map(fn (User $u) => [
                'uuid' => $u->uuid,
                'name' => $u->profile?->display_name ?: ($u->name ?: $u->email),
                'email' => $u->email,
                'role' => $u->role->value,
                'status' => $u->status?->value,
                'subscription_exempt' => (bool) $u->subscription_exempt,
                'free_listings_quota' => (int) $u->free_listings_quota,
                'free_listings_unlimited' => (bool) $u->free_listings_unlimited,
                'free_listings_used' => (int) $u->free_listings_used,
                'listing_placement_credits' => (int) $u->listing_placement_credits,
                // Что выдано отдельно, поверх роли (C3). Пустой список —
                // «только роль», и это обычное состояние сотрудника.
                'granted_sections' => AdminAccess::grantsOf($u),
                // Что даёт роль — по всем ключам, не только по разделам
                // меню: иначе жалобы и удаление записей показывались бы
                // невыданными у модератора, у которого они есть.
                'role_sections' => AdminAccess::keysForRole($u->role),
                'categories' => ($categories[$u->id] ?? collect())->map(fn ($c) => [
                    'id' => (int) $c->id,
                    'name' => (string) $c->name,
                    'slug' => (string) $c->slug,
                ])->values()->all(),
            ])->all(),
            'roles' => $roles,
            'section_levels' => AdminAccess::sectionLevels(),
            'grantable_sections' => AdminAccess::grantableKeys(),
            'max_per_category' => CategoryAdminService::maxPerCategory(),
        ]]);
    }

    #[Endpoint(title: 'Предел администраторов на направление')]
    #[BodyParameter('value', description: 'Сколько администраторов может быть у одного направления', example: 10)]
    public function updateLimit(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['value' => ['required', 'integer', 'min:1', 'max:100']]);
        $old = CategoryAdminService::maxPerCategory();

        SystemSetting::query()->updateOrCreate(
            ['key' => CategoryAdminService::SETTING_KEY],
            ['value' => ['value' => (int) $data['value']], 'group' => 'moderation'],
        );
        $audit->log($request->user(), 'admin.roles.category_admin_limit', null, ['value' => $old], ['value' => (int) $data['value']], $request);

        return response()->json(['data' => ['max_per_category' => CategoryAdminService::maxPerCategory()]]);
    }
}
