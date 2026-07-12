<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VideoCategory;
use Illuminate\Http\JsonResponse;

class IndexVideoCategoriesController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rows = VideoCategory::query()->orderBy('sort_order')->get();

        return response()->json([
            'data' => $rows->map(fn (VideoCategory $c) => [
                'id' => $c->uuid,
                'slug' => $c->slug,
                'title' => $c->title,
                'sort_order' => $c->sort_order,
            ]),
        ]);
    }
}
