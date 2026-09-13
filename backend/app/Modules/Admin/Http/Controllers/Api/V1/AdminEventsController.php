<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClubEvent;
use App\Models\Community;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Services\AuditService;
use Modules\Community\Http\Resources\ClubEventResource;
use Modules\Community\Services\ClubEventService;
use Modules\Community\Support\ClubEventRules;
use Modules\User\Http\Resources\UserCompactResource;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Раздел «Мероприятия» админки: все события — площадки и сообществ.
 *
 * Модерации нет по решению заказчика 14.09: события сообществ создают
 * владелец и модераторы, злоупотребление снимается отсюда. Каждое изменение
 * пишется в аудит — правило проекта.
 */
class AdminEventsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'scope' => ['nullable', 'in:community,platform'],
            'status' => ['nullable', 'in:draft,published,cancelled,past,upcoming,deleted'],
            'community' => ['nullable', 'string', 'max:255'],
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        $status = $request->query('status');
        $query = ClubEvent::query()
            ->when($status === 'deleted', fn ($q) => $q->onlyTrashed())
            ->with(['cover', 'community', 'creator.profile'])
            ->withCount('attendees')
            ->when($request->query('scope'), fn ($q, $scope) => $q->where('scope', $scope))
            ->when($request->query('community'), fn ($q, $slug) => $q->whereHas('community', fn ($c) => $c->where('slug', $slug)))
            ->when($request->query('q'), fn ($q, $term) => $q->where('title', 'ilike', '%'.addcslashes((string) $term, '%_\\').'%'))
            ->when(in_array($status, ['draft', 'published', 'cancelled'], true), fn ($q) => $q->where('status', $status))
            ->when($status === 'past', fn ($q) => $q->past())
            ->when($status === 'upcoming', fn ($q) => $q->upcoming())
            ->orderByDesc('starts_at');

        return ClubEventResource::collection($query->paginate(min(100, max(1, $request->integer('per_page', 30)))))->response();
    }

    public function store(Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $data = $request->validate(ClubEventRules::rules(true) + [
            'community_slug' => ['nullable', 'string', 'exists:communities,slug'],
        ], ClubEventRules::messages());

        $community = filled($data['community_slug'] ?? null)
            ? Community::query()->where('slug', $data['community_slug'])->firstOrFail()
            : null;
        $event = $events->create($community, $request->user(), $data);
        $audit->log($request->user(), 'admin.events.create', $event, null, $event->only(['title', 'scope', 'status', 'starts_at', 'community_id']), $request);

        return (new ClubEventResource($event->load(['cover', 'community'])->loadCount('attendees')))->response()->setStatusCode(201);
    }

    public function update(string $uuid, Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $event = $this->find($uuid);
        $rules = ClubEventRules::rules(false);
        if (! $request->has('starts_at')) {
            unset($rules['starts_at']);
        }
        $data = $request->validate($rules, ClubEventRules::messages());
        $old = $event->only(array_keys($data));
        $events->update($event, $data);
        $audit->log($request->user(), 'admin.events.update', $event, $old, $event->only(array_keys($data)), $request);

        return (new ClubEventResource($event->fresh()->load(['cover', 'community'])->loadCount('attendees')))->response();
    }

    public function cancel(string $uuid, Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $event = $this->find($uuid);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $old = ['status' => $event->status];
        $events->cancel($event, $data['reason'] ?? null);
        $audit->log($request->user(), 'admin.events.cancel', $event, $old, ['status' => $event->status, 'reason' => $event->cancel_reason], $request);

        return (new ClubEventResource($event->load(['cover', 'community'])->loadCount('attendees')))->response();
    }

    public function destroy(string $uuid, Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $event = $this->find($uuid);
        $old = $event->only(['title', 'scope', 'status', 'starts_at', 'community_id']);
        $events->delete($event);
        $audit->log($request->user(), 'admin.events.delete', $event, $old, null, $request);

        return response()->json(['data' => ['message' => 'Мероприятие удалено.']]);
    }

    public function attendees(string $uuid, Request $request, ClubEventService $events): JsonResponse
    {
        $event = ClubEvent::withTrashed()->where('uuid', $uuid)->first() ?? throw new NotFoundHttpException('Мероприятие не найдено.');

        return UserCompactResource::collection($events->attendees($event, min(100, max(1, $request->integer('per_page', 50)))))->response();
    }

    private function find(string $uuid): ClubEvent
    {
        return ClubEvent::query()->where('uuid', $uuid)->first() ?? throw new NotFoundHttpException('Мероприятие не найдено.');
    }
}
