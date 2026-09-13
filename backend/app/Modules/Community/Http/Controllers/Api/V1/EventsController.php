<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClubEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Modules\Admin\Services\AuditService;
use Modules\Community\Http\Resources\ClubEventResource;
use Modules\Community\Services\ClubEventService;
use Modules\Community\Support\ClubEventRules;
use Modules\User\Http\Resources\UserCompactResource;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Одно мероприятие — сообщества или площадки: показ, участники, правка,
 * отмена, удаление, «пойду». Права — EventPolicy.
 *
 * Невидимое событие отвечает 404, а не 403: закрытое сообщество не выдаёт,
 * что у него что-то запланировано.
 */
class EventsController extends Controller
{
    /** События площадки: раздел «Мероприятия». */
    public function index(Request $request, ClubEventService $events): JsonResponse
    {
        $user = $request->user('sanctum');
        $when = in_array($request->query('when'), ['upcoming', 'past'], true) ? (string) $request->query('when') : 'upcoming';
        $page = $events->listPlatform($when, min(50, max(1, $request->integer('per_page', 20))));
        $page->getCollection()->load(['cover', 'attendees' => fn ($q) => $user ? $q->where('users.id', $user->id) : $q->whereRaw('1 = 0')])
            ->loadCount('attendees');

        return ClubEventResource::collection($page)->response();
    }

    public function show(string $uuid, Request $request): JsonResponse
    {
        $event = $this->visible($uuid, $request);

        return (new ClubEventResource($event->load(['cover', 'community', 'creator.profile.avatar'])->loadCount('attendees')))->response();
    }

    public function attendees(string $uuid, Request $request, ClubEventService $events): JsonResponse
    {
        $event = $this->visible($uuid, $request);
        $page = $events->attendees($event, min(100, max(1, $request->integer('per_page', 30))));

        return UserCompactResource::collection($page)->response();
    }

    public function update(string $uuid, Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $event = $this->find($uuid);
        $user = $request->user();
        if (! Gate::forUser($user)->allows('update', $event)) {
            throw new AccessDeniedHttpException('Править мероприятие может его организатор.');
        }
        if ($event->status === ClubEvent::STATUS_CANCELLED) {
            throw new AccessDeniedHttpException('Отменённое мероприятие не редактируется.');
        }

        $rules = ClubEventRules::rules(false);
        // Прошедшее событие правят без переноса даты: описание, обложку.
        if ($event->isPast() && ! $request->has('starts_at')) {
            unset($rules['starts_at']);
        }
        $data = $request->validate($rules, ClubEventRules::messages());
        $old = $event->only(array_keys($data));
        $events->update($event, $data);
        $audit->log($user, 'event.update', $event, $old, $event->only(array_keys($data)), $request);

        return (new ClubEventResource($event->fresh()->load(['cover', 'community'])->loadCount('attendees')))->response();
    }

    public function cancel(string $uuid, Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $event = $this->find($uuid);
        $user = $request->user();
        if (! Gate::forUser($user)->allows('update', $event)) {
            throw new AccessDeniedHttpException('Отменить мероприятие может его организатор.');
        }
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $old = ['status' => $event->status];
        $events->cancel($event, $data['reason'] ?? null);
        $audit->log($user, 'event.cancel', $event, $old, ['status' => $event->status, 'reason' => $event->cancel_reason], $request);

        return (new ClubEventResource($event->load(['cover', 'community'])->loadCount('attendees')))->response();
    }

    public function destroy(string $uuid, Request $request, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $event = $this->find($uuid);
        $user = $request->user();
        if (! Gate::forUser($user)->allows('delete', $event)) {
            throw new AccessDeniedHttpException('Удалить мероприятие может его организатор.');
        }
        $old = $event->only(['title', 'status', 'starts_at', 'community_id']);
        $events->delete($event);
        $audit->log($user, 'event.delete', $event, $old, null, $request);

        return response()->json(['message' => 'Мероприятие удалено.']);
    }

    public function attend(string $uuid, Request $request, ClubEventService $events): JsonResponse
    {
        $event = $this->visible($uuid, $request);
        $user = $request->user();
        if (! Gate::forUser($user)->allows('attend', $event)) {
            throw new AccessDeniedHttpException($event->isPast()
                ? 'Мероприятие уже прошло.'
                : 'На это мероприятие сейчас нельзя отметиться.');
        }
        $result = $events->attend($event, $user);

        return (new ClubEventResource($event->load(['cover', 'community'])->loadCount('attendees')))
            ->additional($result)->response();
    }

    public function unattend(string $uuid, Request $request, ClubEventService $events): JsonResponse
    {
        $event = $this->visible($uuid, $request);
        $events->unattend($event, $request->user());

        return (new ClubEventResource($event->load(['cover', 'community'])->loadCount('attendees')))
            ->additional(['going' => false])->response();
    }

    private function find(string $uuid): ClubEvent
    {
        $event = ClubEvent::query()->where('uuid', $uuid)->first();
        if (! $event) {
            throw new NotFoundHttpException('Мероприятие не найдено.');
        }

        return $event;
    }

    private function visible(string $uuid, Request $request): ClubEvent
    {
        $event = $this->find($uuid);
        $user = $request->user('sanctum');
        if (! Gate::forUser($user)->allows('view', $event)) {
            throw new NotFoundHttpException('Мероприятие не найдено.');
        }

        return $event;
    }
}
