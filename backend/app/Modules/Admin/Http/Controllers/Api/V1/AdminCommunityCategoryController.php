<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\CommunityCategory;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Controllers\Api\V1\Concerns\DerivedCategoryTree;
use Modules\Admin\Http\Requests\UpsertCategoryRequest;
use Modules\Admin\Services\AuditService;

#[Group('Admin — Categories', weight: 40)]
class AdminCommunityCategoryController extends AdminCategoryController
{
    use DerivedCategoryTree;

    public function store(UpsertCategoryRequest $request, AuditService $audit): JsonResponse
    {
        $this->refuseDirectEdit();
    }

    public function update(UpsertCategoryRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $this->refuseDirectEdit();
    }

    public function destroy(int $id, AuditService $audit): JsonResponse
    {
        $this->refuseDirectEdit();
    }

    protected function modelClass(): string
    {
        return CommunityCategory::class;
    }

    protected function auditPrefix(): string
    {
        return 'admin.categories.community';
    }
}
