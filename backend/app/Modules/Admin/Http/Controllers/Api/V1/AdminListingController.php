<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\ListingStatus;
use App\Http\Controllers\Controller;
use App\Models\Listing;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;
use Modules\Listing\Http\Resources\ListingResource;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Content', weight: 46)]
class AdminListingController extends Controller
{
    #[QueryParameter('status', description: 'Фильтр по статусу', required: false, example: 'published')]
    #[QueryParameter('q', description: 'Поиск по заголовку', required: false, example: 'двигатель')]
    public function index(): AnonymousResourceCollection
    {
        $status = (string) request()->query('status', '');
        $q = trim((string) request()->query('q', ''));

        $items = Listing::query()
            ->with(['author.profile', 'category', 'city'])
            ->when(ListingStatus::tryFrom($status), fn ($query, $s) => $query->where('status', $s))
            ->when($q !== '', fn ($query) => $query->where('title', 'ilike', '%'.$q.'%'))
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return ListingResource::collection($items);
    }

    #[Endpoint(title: 'Изменить статус объявления')]
    #[PathParameter('uuid', description: 'UUID объявления')]
    #[BodyParameter('status', description: 'Новый статус', example: 'unpublished')]
    public function update(string $uuid, AuditService $audit): ListingResource
    {
        $listing = Listing::query()->where('uuid', $uuid)->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        $data = request()->validate([
            'status' => ['required', Rule::enum(ListingStatus::class)],
        ]);

        $old = $listing->toArray();
        $status = ListingStatus::from($data['status']);

        $listing->status = $status;
        if ($status === ListingStatus::Published && $listing->published_at === null) {
            $listing->published_at = now();
        }
        $listing->save();

        $audit->log(request()->user(), 'admin.listings.update', $listing, $old, $listing->fresh()->toArray(), request());

        return new ListingResource($listing->fresh(['author.profile', 'category', 'city']));
    }

    #[PathParameter('uuid', description: 'UUID объявления')]
    public function destroy(string $uuid, AuditService $audit): JsonResponse
    {
        $listing = Listing::query()->where('uuid', $uuid)->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        $listing->delete();
        $audit->log(request()->user(), 'admin.listings.delete', $listing, $listing->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Объявление удалено.']]);
    }
}
