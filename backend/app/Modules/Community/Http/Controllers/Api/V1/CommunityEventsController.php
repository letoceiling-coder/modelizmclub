<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunityEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Http\Resources\CommunityEventResource;
use Modules\Community\Services\CommunityHubService;
use Modules\Community\Services\CommunityService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CommunityEventsController extends Controller
{
    public function index(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user('sanctum');

        $events = CommunityEvent::query()
            ->where('community_id', $community->id)
            ->with(['cover', 'attendees' => fn ($q) => $user ? $q->where('users.id', $user->id) : $q->whereRaw('1 = 0')])
            ->withCount('attendees')
            ->orderBy('starts_at')
            ->get();

        return CommunityEventResource::collection($events)->response();
    }

    public function store(string $slug, Request $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();
        if (! $community->canManage($user)) {
            throw new AccessDeniedHttpException('Создавать мероприятия может администратор сообщества.');
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['nullable', 'string', 'max:4000'],
            'starts_at' => ['required', 'date', 'after:now'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'cover_media_uuid' => ['nullable', 'uuid', 'exists:media,uuid'],
        ]);

        $event = $hub->createEvent($community, $user, $data)->load(['cover', 'attendees'])->loadCount('attendees');

        return (new CommunityEventResource($event))->response()->setStatusCode(201);
    }

    public function attend(string $slug, string $uuid, Request $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();
        $isMember = $community->members()->where('users.id', $user->id)->exists()
            || $community->isOwnedBy($user);
        if (! $isMember) {
            throw new AccessDeniedHttpException('Записаться может только участник сообщества.');
        }

        $event = CommunityEvent::query()
            ->where('community_id', $community->id)
            ->where('uuid', $uuid)
            ->first();
        if (! $event) {
            throw new NotFoundHttpException('Мероприятие не найдено.');
        }

        $going = $hub->toggleAttendance($event, $user);
        $event->load(['cover', 'attendees'])->loadCount('attendees');

        return (new CommunityEventResource($event))
            ->additional(['going' => $going])
            ->response();
    }
}
