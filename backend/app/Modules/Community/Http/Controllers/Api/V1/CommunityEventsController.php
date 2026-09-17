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
use Modules\Community\Services\CommunityService;
use Modules\Community\Support\ClubEventRules;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Мероприятия у сообщества: список и создание.
 * Одно событие, правка, отмена, участие — EventsController (/events/{uuid}).
 */
class CommunityEventsController extends Controller
{
    public function index(string $slug, Request $request, CommunityService $communities, ClubEventService $events): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user('sanctum');
        if (! $community->isOpen() && ! ($user && ($community->canModerate($user) || $community->members()->where('users.id', $user->id)->exists()))) {
            throw new NotFoundHttpException('Мероприятия видят участники сообщества.');
        }

        $when = in_array($request->query('when'), ['upcoming', 'past', 'all'], true) ? (string) $request->query('when') : 'upcoming';
        $withDrafts = $user !== null && Gate::forUser($user)->allows('create', [ClubEvent::class, $community]);
        $page = $events->listForCommunity($community, $when, min(50, max(1, $request->integer('per_page', 20))), $withDrafts);
        $page->getCollection()->load(['cover', 'community', 'attendees' => fn ($q) => $user ? $q->where('users.id', $user->id) : $q->whereRaw('1 = 0')])
            ->loadCount('attendees');

        return ClubEventResource::collection($page)->response();
    }

    public function store(string $slug, Request $request, CommunityService $communities, ClubEventService $events, AuditService $audit): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();
        if (! Gate::forUser($user)->allows('create', [ClubEvent::class, $community])) {
            throw new AccessDeniedHttpException('Создавать мероприятия может администратор сообщества.');
        }

        $data = $request->validate(ClubEventRules::rules(true), ClubEventRules::messages());
        $event = $events->create($community, $user, $data);
        $audit->log($user, 'event.create', $event, null, $event->only(['title', 'starts_at', 'status', 'community_id']), $request);

        return (new ClubEventResource($event->load(['cover', 'community', 'attendees'])->loadCount('attendees')))
            ->response()->setStatusCode(201);
    }
}
