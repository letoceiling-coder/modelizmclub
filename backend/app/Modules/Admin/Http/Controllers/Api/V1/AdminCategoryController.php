<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\UpsertCategoryRequest;
use Modules\Admin\Services\AuditService;
use Modules\Catalog\Services\CatalogService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

abstract class AdminCategoryController extends Controller
{
    abstract protected function modelClass(): string;

    abstract protected function auditPrefix(): string;

    public function index(): JsonResponse
    {
        /** @var class-string<Model> $class */
        $class = $this->modelClass();

        $items = $class::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate((int) request()->integer('per_page', 50));

        return response()->json(['data' => $items]);
    }

    #[Endpoint(title: 'Создать категорию')]
    #[BodyParameter('name', example: 'Новая категория')]
    #[BodyParameter('slug', example: 'new-category')]
    #[BodyParameter('icon', required: false, example: 'plane')]
    #[BodyParameter('sort_order', required: false, example: 10)]
    #[BodyParameter('is_active', required: false, example: true)]
    public function store(UpsertCategoryRequest $request, AuditService $audit): JsonResponse
    {
        /** @var class-string<Model> $class */
        $class = $this->modelClass();
        $category = $class::query()->create($request->validated());
        $audit->log($request->user(), $this->auditPrefix().'.create', $category, null, $category->toArray(), $request);
        CatalogService::flushCache();

        return response()->json(['data' => $category], 201);
    }

    #[PathParameter('id', description: 'ID категории (slug aviation после seed)', example: 1)]
    public function show(int $id): JsonResponse
    {
        $category = $this->findCategory($id);

        return response()->json(['data' => $category]);
    }

    #[PathParameter('id', description: 'ID категории', example: 1)]
    public function update(UpsertCategoryRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $category = $this->findCategory($id);
        $old = $category->toArray();
        $category->update($request->validated());
        $audit->log($request->user(), $this->auditPrefix().'.update', $category, $old, $category->fresh()->toArray(), $request);
        CatalogService::flushCache();

        return response()->json(['data' => $category->fresh()]);
    }

    #[PathParameter('id', description: 'ID категории (создайте копию для DELETE-теста)', example: 999)]
    public function destroy(int $id, AuditService $audit): JsonResponse
    {
        $category = $this->findCategory($id);
        $category->delete();
        $audit->log(request()->user(), $this->auditPrefix().'.delete', $category, $category->toArray(), null, request());
        CatalogService::flushCache();

        return response()->json(['data' => ['message' => 'Категория удалена.']]);
    }

    protected function findCategory(int $id): Model
    {
        /** @var class-string<Model> $class */
        $class = $this->modelClass();
        $category = $class::query()->find($id);

        if (! $category) {
            throw new NotFoundHttpException('Категория не найдена.');
        }

        return $category;
    }
}
