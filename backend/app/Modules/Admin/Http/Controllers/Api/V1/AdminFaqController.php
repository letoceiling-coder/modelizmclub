<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FaqArticle;
use App\Models\FaqCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Requests\UpsertFaqArticleRequest;
use Modules\Admin\Http\Requests\UpsertFaqCategoryRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminFaqController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = FaqCategory::query()
            ->with(['articles' => fn ($q) => $q->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get()
            ->map(fn (FaqCategory $c) => $this->categoryToArray($c));

        return response()->json(['data' => $categories]);
    }

    public function storeCategory(UpsertFaqCategoryRequest $request, AuditService $audit): JsonResponse
    {
        $category = FaqCategory::query()->create($request->validated());
        $audit->log($request->user(), 'admin.faq.category.create', $category, null, $category->toArray(), $request);

        return response()->json(['data' => $this->categoryToArray($category->load(['articles' => fn ($q) => $q->orderBy('sort_order')]))], 201);
    }

    public function updateCategory(UpsertFaqCategoryRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $category = FaqCategory::query()->find($id);
        if (! $category) {
            throw new NotFoundHttpException('Категория FAQ не найдена.');
        }

        $old = $category->toArray();
        $category->update($request->validated());
        $audit->log($request->user(), 'admin.faq.category.update', $category, $old, $category->fresh()->toArray(), $request);

        return response()->json(['data' => $this->categoryToArray($category->fresh()->load(['articles' => fn ($q) => $q->orderBy('sort_order')]))]);
    }

    public function destroyCategory(int $id, AuditService $audit): JsonResponse
    {
        $category = FaqCategory::query()->find($id);
        if (! $category) {
            throw new NotFoundHttpException('Категория FAQ не найдена.');
        }

        $old = $category->toArray();
        $category->delete();
        $audit->log(request()->user(), 'admin.faq.category.delete', $category, $old, null, request());

        return response()->json(['data' => ['message' => 'Категория удалена.']]);
    }

    public function storeArticle(UpsertFaqArticleRequest $request, AuditService $audit): JsonResponse
    {
        $article = FaqArticle::query()->create($request->validated());
        $audit->log($request->user(), 'admin.faq.article.create', $article, null, $article->toArray(), $request);

        return response()->json(['data' => $this->articleToArray($article)], 201);
    }

    public function updateArticle(UpsertFaqArticleRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $article = FaqArticle::query()->find($id);
        if (! $article) {
            throw new NotFoundHttpException('Вопрос FAQ не найден.');
        }

        $old = $article->toArray();
        $article->update($request->validated());
        $audit->log($request->user(), 'admin.faq.article.update', $article, $old, $article->fresh()->toArray(), $request);

        return response()->json(['data' => $this->articleToArray($article->fresh())]);
    }

    public function destroyArticle(int $id, AuditService $audit): JsonResponse
    {
        $article = FaqArticle::query()->find($id);
        if (! $article) {
            throw new NotFoundHttpException('Вопрос FAQ не найден.');
        }

        $old = $article->toArray();
        $article->delete();
        $audit->log(request()->user(), 'admin.faq.article.delete', $article, $old, null, request());

        return response()->json(['data' => ['message' => 'Вопрос удалён.']]);
    }

    public function reorderArticles(Request $request, AuditService $audit): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'integer'],
            'items.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($validated['items'] as $row) {
            FaqArticle::query()->whereKey($row['id'])->update(['sort_order' => $row['sort_order']]);
        }

        $audit->log($request->user(), 'admin.faq.article.reorder', null, null, $validated, $request);

        return response()->json(['data' => ['message' => 'Порядок обновлён.']]);
    }

    /** @return array<string, mixed> */
    private function categoryToArray(FaqCategory $category): array
    {
        return [
            'id' => $category->id,
            'slug' => $category->slug,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
            'is_active' => $category->is_active,
            'articles' => $category->articles->map(fn (FaqArticle $a) => $this->articleToArray($a)),
        ];
    }

    /** @return array<string, mixed> */
    private function articleToArray(FaqArticle $article): array
    {
        return [
            'id' => $article->id,
            'category_id' => $article->category_id,
            'question' => $article->question,
            'answer' => $article->answer,
            'sort_order' => $article->sort_order,
            'is_active' => $article->is_active,
        ];
    }
}
