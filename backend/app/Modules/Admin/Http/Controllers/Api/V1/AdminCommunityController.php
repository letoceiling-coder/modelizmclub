<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Community;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Modules\Admin\Http\Requests\UpsertCommunityRequest;
use Modules\Admin\Services\AuditService;
use Modules\Community\Http\Resources\CommunityResource;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Communities', weight: 50)]
class AdminCommunityController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $items = Community::query()
            ->with('category')
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return CommunityResource::collection($items);
    }

    #[Endpoint(title: 'Создать сообщество')]
    #[BodyParameter('category_id', description: 'ID из GET /admin/categories/community', example: 1)]
    #[BodyParameter('name', example: 'Swagger Test Club')]
    #[BodyParameter('slug', example: 'swagger-test-club')]
    #[BodyParameter('description', example: 'Сообщество для DELETE-теста')]
    #[BodyParameter('status', example: 'active')]
    public function store(UpsertCommunityRequest $request, AuditService $audit): JsonResponse
    {
        $community = Community::query()->create([
            ...$request->validated(),
            'uuid' => (string) Str::uuid(),
            'created_by' => $request->user()->id,
        ]);

        $audit->log($request->user(), 'admin.communities.create', $community, null, $community->toArray(), $request);

        return (new CommunityResource($community->load('category')))
            ->response()
            ->setStatusCode(201);
    }

    #[PathParameter('slug', example: SwaggerFixtures::COMMUNITY_SLUG)]
    public function show(string $slug): CommunityResource
    {
        $community = Community::query()->with('category')->where('slug', $slug)->first();

        if (! $community) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        return new CommunityResource($community);
    }

    #[PathParameter('slug', example: SwaggerFixtures::COMMUNITY_SLUG)]
    #[BodyParameter('description', example: 'Обновлённое описание')]
    public function update(UpsertCommunityRequest $request, string $slug, AuditService $audit): CommunityResource
    {
        $community = Community::query()->where('slug', $slug)->first();

        if (! $community) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        $old = $community->toArray();
        $community->update($request->validated());
        $audit->log($request->user(), 'admin.communities.update', $community, $old, $community->fresh()->toArray(), $request);

        return new CommunityResource($community->fresh('category'));
    }

    #[PathParameter('slug', description: 'Slug для DELETE (создайте swagger-test-club)', example: 'swagger-test-club')]
    public function destroy(string $slug, AuditService $audit): JsonResponse
    {
        $community = Community::query()->where('slug', $slug)->first();

        if (! $community) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        $community->delete();
        $audit->log(request()->user(), 'admin.communities.delete', $community, $community->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Сообщество удалено.']]);
    }
}
