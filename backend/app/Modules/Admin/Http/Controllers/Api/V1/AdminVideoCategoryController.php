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
            ->withCount('videos')
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
            'is_active' => ['nullable', 'boolean'],
        ]);

        $maxOrder = (int) VideoCategory::query()->max('sort_order');

        $category = VideoCategory::query()->create([
            'title' => $data['name'],
            'slug' => $data['slug'],
            'sort_order' => $data['sort_order'] ?? ($maxOrder + 10),
            'is_active' => $data['is_active'] ?? true,
        ]);

        $category->loadCount('videos');
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
            'is_active' => ['nullable', 'boolean'],
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
        if (array_key_exists('is_active', $data)) {
            $category->is_active = $data['is_active'];
        }
        $category->save();

        $category->loadCount('videos');
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

    public function reorder(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:video_categories,id'],
        ]);

        foreach ($data['ids'] as $order => $id) {
            VideoCategory::query()->whereKey($id)->update(['sort_order' => ($order + 1) * 10]);
        }

        $audit->log($request->user(), 'video_category.reorder', null, null, ['ids' => $data['ids']], $request);

        return response()->json(['data' => ['message' => 'Порядок сохранён.']]);
    }

    private function find(int $id): VideoCategory
    {
        $category = VideoCategory::query()->withCount('videos')->find($id);

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
            'is_active' => (bool) ($category->is_active ?? true),
            'videos_count' => (int) ($category->videos_count ?? 0),
        ];
    }
}
