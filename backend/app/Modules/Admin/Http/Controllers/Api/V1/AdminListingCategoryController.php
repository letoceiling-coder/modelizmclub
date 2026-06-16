<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\ListingCategory;
use Dedoc\Scramble\Attributes\Group;

#[Group('Admin — Categories', weight: 40)]
class AdminListingCategoryController extends AdminCategoryController
{
    protected function modelClass(): string
    {
        return ListingCategory::class;
    }

    protected function auditPrefix(): string
    {
        return 'admin.categories.listing';
    }
}
