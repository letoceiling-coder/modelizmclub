<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\CommunityCategory;
use Dedoc\Scramble\Attributes\Group;

#[Group('Admin — Categories', weight: 40)]
class AdminCommunityCategoryController extends AdminCategoryController
{
    protected function modelClass(): string
    {
        return CommunityCategory::class;
    }

    protected function auditPrefix(): string
    {
        return 'admin.categories.community';
    }
}
