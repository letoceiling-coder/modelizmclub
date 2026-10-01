<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Support\CategoryOrder;
use App\Http\Controllers\Controller;
use App\Models\PostCategory;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Http\Requests\UpsertCategoryRequest;
use Modules\Admin\Services\AuditService;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Support\CategoryMirrors;
use Modules\Catalog\Services\CategoryTaxonomyService;
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
            ->tap(fn ($q) => CategoryOrder::apply($q))
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
        $this->assertSlugFree((string) $request->validated('slug'), null);
        $category = DB::transaction(function () use ($class, $request) {
            $category = $class::query()->create($request->validated());
            $this->afterMutate($category, null, $request->validated());

            return $category->fresh();
        });
        $audit->log($request->user(), $this->auditPrefix().'.create', $category, null, $category->toArray(), $request);
        CatalogService::flushCache();

        return response()->json(['data' => $this->presentForResponse($category)], 201);
    }

    #[PathParameter('id', description: 'ID категории (slug aviation после seed)', example: 1)]
    public function show(int $id): JsonResponse
    {
        $category = $this->findCategory($id);

        return response()->json(['data' => $this->presentForResponse($category)]);
    }

    #[PathParameter('id', description: 'ID категории', example: 1)]
    public function update(UpsertCategoryRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $category = $this->findCategory($id);
        $this->assertSlugFree((string) $request->validated('slug'), $id);
        $old = $category->toArray();
        $category = DB::transaction(function () use ($category, $request, $old) {
            $category->update($request->validated());
            $this->afterMutate($category->fresh(), isset($old['path']) ? (string) $old['path'] : null, $request->validated());

            return $category->fresh();
        });
        $audit->log($request->user(), $this->auditPrefix().'.update', $category, $old, $category->toArray(), $request);
        CatalogService::flushCache();

        return response()->json(['data' => $this->presentForResponse($category)]);
    }

    #[PathParameter('id', description: 'ID категории (создайте копию для DELETE-теста)', example: 999)]
    public function destroy(int $id, AuditService $audit): JsonResponse
    {
        $category = $this->findCategory($id);
        $прежнее = $category->toArray();

        /*
         * Зеркала — до удаления узла: после него ссылки на них теряются, и
         * найти отражения будет уже нечем.
         *
         * 29.09 админка ответила «Категория удалена», а две строки в
         * `listing_categories` и `community_categories` остались сиротами.
         * Неделей раньше такие же сироты стоили отдельной миграции.
         */
        /*
         * Одной транзакцией — как `store` и `update` рядом.
         *
         * Без неё возможно полуудалённое состояние: первое зеркало снято и
         * закоммичено, на втором запрос упал, узел остался — а ссылка на
         * снятое зеркало обнулилась внешним ключом. Ревью назвало и путь:
         * гонка между проверкой занятости и удалением.
         */
        $зеркала = DB::transaction(function () use ($category): array {
            $снято = CategoryMirrors::removeFor($category);
            $category->delete();

            return $снято;
        });
        $audit->log(
            request()->user(),
            $this->auditPrefix().'.delete',
            $category,
            $прежнее + ['mirrors' => $зеркала],
            null,
            request(),
        );
        CatalogService::flushCache();

        // Что осталось — говорим вслух. Молчаливое «удалено» при живых
        // зеркалах и было дефектом.
        $сообщение = $зеркала['kept'] === []
            ? 'Категория удалена.'
            : 'Категория удалена, но отражения остались: '.implode('; ', $зеркала['kept']).'.';

        return response()->json(['data' => [
            'message' => $сообщение,
            'mirrors_deleted' => $зеркала['deleted'],
            'mirrors_kept' => $зеркала['kept'],
        ]]);
    }

    /**
     * Slug занят — сказать словами, а не упасть пятисоткой.
     *
     * С 10.09 slug уникален во всей таблице, а не среди соседей
     * (`make_category_slugs_globally_unique`). Правило в
     * `UpsertCategoryRequest` этого не знало: занятый slug доходил до
     * вставки, Postgres отвечал нарушением ограничения, и наружу уходило
     * 500 с текстом «Внутренняя ошибка сервера. Попробуйте позже».
     *
     * Совет повторить позже здесь вреден вдвойне: повтор не поможет
     * никогда, а человек видит отказ, не содержащий того единственного,
     * что нужно сделать, — сменить slug. Замерено 01.10: код 500.
     *
     * Проверка живёт в контроллере, а не в запросе, потому что таблица
     * известна здесь: один и тот же `UpsertCategoryRequest` обслуживает
     * направления, объявления и сообщества.
     *
     * Ограничение в базе остаётся последним словом: между этой проверкой
     * и вставкой slug может занять другой запрос. Это редкость, а не
     * ежедневный путь, который и чинится.
     */
    protected function assertSlugFree(string $slug, ?int $exceptId): void
    {
        /** @var class-string<Model> $class */
        $class = $this->modelClass();

        $занят = $class::query()
            ->where('slug', $slug)
            ->when($exceptId !== null, fn ($q) => $q->whereKeyNot($exceptId))
            ->exists();

        if ($занят) {
            throw ValidationException::withMessages([
                'slug' => ["Slug «{$slug}» уже занят другой категорией — выберите другой."],
            ]);
        }
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

    /** Что отдать в ответе на чтение и запись одного узла. */
    protected function presentForResponse(Model $category): mixed
    {
        return $category;
    }

    /** @param  array<string, mixed>  $validated */
    protected function afterMutate(Model $category, ?string $previousPath = null, array $validated = []): void
    {
        if ($category instanceof PostCategory) {
            app(CategoryTaxonomyService::class)->syncFromPostCategory($category, $previousPath);
        }
    }
}
