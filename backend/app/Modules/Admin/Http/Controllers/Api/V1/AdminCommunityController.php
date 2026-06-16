<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Community;
use Dedoc\Scramble\Attributes\Group;
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

    public function show(string $slug): CommunityResource
    {
        $community = Community::query()->with('category')->where('slug', $slug)->first();

        if (! $community) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        return new CommunityResource($community);
    }

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
