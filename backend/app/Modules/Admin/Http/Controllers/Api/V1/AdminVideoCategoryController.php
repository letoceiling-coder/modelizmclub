<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VideoCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminVideoCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $items = VideoCategory::query()
            ->orderBy('sort_order')
            ->orderBy('title')
            ->paginate((int) request()->integer('per_page', 50));

        $items->getCollection()->transform(fn (VideoCategory $c) => $this->format($c));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['required', 'string', 'max:120', 'unique:video_categories,slug'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $category = VideoCategory::query()->create([
            'title' => $data['name'],
            'slug' => $data['slug'],
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        $audit->log($request->user(), 'video_category.create', $category, null, $category->toArray(), $request);

        return response()->json(['data' => $this->format($category)], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->format($this->find($id))]);
    }

    public function update(Request $request, int $id, AuditService $audit): JsonResponse
    {
        $category = $this->find($id);
        $old = $category->toArray();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['sometimes', 'string', 'max:120', Rule::unique('video_categories', 'slug')->ignore($category->id)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $data)) {
            $category->title = $data['name'];
        }
        if (array_key_exists('slug', $data)) {
            $category->slug = $data['slug'];
        }
        if (array_key_exists('sort_order', $data)) {
            $category->sort_order = $data['sort_order'];
        }
        $category->save();

        $audit->log($request->user(), 'video_category.update', $category, $old, $category->fresh()->toArray(), $request);

        return response()->json(['data' => $this->format($category->fresh())]);
    }

    public function destroy(int $id, AuditService $audit): JsonResponse
    {
        $category = $this->find($id);
        $category->delete();
        $audit->log(request()->user(), 'video_category.delete', $category, $category->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Категория удалена.']]);
    }

    private function find(int $id): VideoCategory
    {
        $category = VideoCategory::query()->find($id);

        if (! $category) {
            throw new NotFoundHttpException('Категория не найдена.');
        }

        return $category;
    }

    /** @return array<string, mixed> */
    private function format(VideoCategory $category): array
    {
        return [
            'id' => $category->id,
            'parent_id' => null,
            'name' => $category->title,
            'slug' => $category->slug,
            'icon' => null,
            'sort_order' => $category->sort_order,
            'is_active' => true,
        ];
    }
}
