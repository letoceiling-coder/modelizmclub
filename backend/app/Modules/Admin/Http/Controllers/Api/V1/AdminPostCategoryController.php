<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\PostCategory;
use Dedoc\Scramble\Attributes\Group;

#[Group('Admin — Categories', weight: 40)]
class AdminPostCategoryController extends AdminCategoryController
{
    protected function modelClass(): string
    {
        return PostCategory::class;
    }

    protected function auditPrefix(): string
    {
        return 'admin.categories.post';
    }
}
