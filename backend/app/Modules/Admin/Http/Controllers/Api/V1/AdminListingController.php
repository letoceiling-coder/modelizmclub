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
use Modules\Admin\Services\ModerationService;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;
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

    #[PathParameter('uuid', description: 'UUID объявления')]
    public function show(string $uuid): ListingResource
    {
        $listing = Listing::query()
            ->with(['author.profile', 'category', 'subcategory', 'city', 'mediaItems.media'])
            ->where('uuid', $uuid)
            ->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        return new ListingResource($listing);
    }

    #[Endpoint(title: 'Изменить объявление')]
    #[PathParameter('uuid', description: 'UUID объявления')]
    #[BodyParameter('status', description: 'Новый статус', example: 'unpublished')]
    public function update(string $uuid, AuditService $audit, ModerationService $moderation, ListingService $listings): ListingResource
    {
        $listing = Listing::query()->where('uuid', $uuid)->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        $data = request()->validate([
            'status' => ['sometimes', Rule::enum(ListingStatus::class)],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'price_cents' => ['sometimes', 'integer', 'min:0'],
            'rejection_reason' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        if ($data === []) {
            abort(422, 'Укажите хотя бы одно поле для изменения.');
        }

        $old = $listing->toArray();

        if (array_key_exists('title', $data)) {
            $listing->title = $data['title'];
        }
        if (array_key_exists('description', $data)) {
            $listing->description = $data['description'];
        }
        if (array_key_exists('price_cents', $data)) {
            $listing->price_cents = $data['price_cents'];
        }
        if (array_key_exists('rejection_reason', $data)) {
            $listing->rejection_reason = $data['rejection_reason'];
        }
        $listing->save();

        /*
         * Смена статуса — это решение модератора, а не присваивание поля.
         *
         * Раньше здесь стояло `$listing->status = $status`, и очередь модерации
         * об этом не узнавала. На проде так и вышло: пять объявлений
         * опубликованы из этого редактора 01.09, а их записи в очереди с тех
         * пор лежат в `pending` — я нашёл их по журналу аудита, все пять с
         * переходом `pending_moderation -> published`. Модератор видел пять
         * задач, решённых неделю назад, авторы не получили уведомления
         * «Объявление опубликовано» (его шлёт `markPublished`), а в
         * `moderation_actions` не осталось ни следа, кто и когда пропустил лот.
         *
         * Теперь публикация, отклонение и отправка на доработку идут через
         * `ModerationService` — тот же путь, что у кнопок в очереди. Второго
         * механизма нет нарочно: он бы снова разошёлся с первым.
         *
         * Остальные статусы (снят с публикации, архив, продано) решением
         * модератора не являются и очереди не касаются — они остаются простым
         * присваиванием.
         */
        if (array_key_exists('status', $data)) {
            $status = ListingStatus::from($data['status']);
            $actor = request()->user();

            if ($status !== $listing->status) {
                match ($status) {
                    ListingStatus::Published => $moderation->approve('listings', $listing->uuid, $actor),
                    ListingStatus::Rejected => $moderation->reject(
                        'listings',
                        $listing->uuid,
                        $actor,
                        $data['rejection_reason'] ?? $listing->rejection_reason,
                    ),
                    ListingStatus::Revision => $moderation->requestRevision(
                        'listings',
                        $listing->uuid,
                        $actor,
                        $data['rejection_reason'] ?? $listing->rejection_reason,
                    ),
                    /*
                     * Возврат на проверку — тоже решение, и без записи в
                     * очереди он повторил бы ту же беду зеркально: статус
                     * `pending_moderation` есть, задачи у модератора нет.
                     */
                    ListingStatus::PendingModeration => (function () use ($listing, $listings): void {
                        $listing->forceFill(['status' => ListingStatus::PendingModeration, 'published_at' => null])->save();
                        $listings->enqueueModeration($listing);
                    })(),
                    default => $listing->forceFill(['status' => $status])->save(),
                };

                $listing = $listing->fresh() ?? $listing;
            }
        }

        $audit->log(request()->user(), 'admin.listings.update', $listing, $old, $listing->fresh()->toArray(), request());

        return new ListingResource($listing->fresh(['author.profile', 'category', 'subcategory', 'city', 'mediaItems.media']));
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
