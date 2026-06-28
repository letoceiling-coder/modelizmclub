<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Notifications', weight: 30)]
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = $user->notifications()->paginate((int) $request->integer('per_page', 20));

        return response()->json([
            'data' => collect($items->items())->map(fn (DatabaseNotification $n) => $this->present($n))->all(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
                'unread' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['data' => ['unread' => $request->user()->unreadNotifications()->count()]]);
    }

    public function markRead(string $id, Request $request): JsonResponse
    {
        $notification = $request->user()->notifications()->whereKey($id)->first();

        if (! $notification) {
            throw new NotFoundHttpException('Уведомление не найдено.');
        }

        $notification->markAsRead();

        return response()->json(['data' => $this->present($notification->fresh())]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['data' => ['unread' => 0]]);
    }

    /** @return array<string, mixed> */
    private function present(DatabaseNotification $n): array
    {
        $data = is_array($n->data) ? $n->data : (array) json_decode((string) $n->data, true);

        return [
            'id' => $n->id,
            'type' => $data['type'] ?? 'system',
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? '',
            'link' => $data['link'] ?? null,
            'read' => $n->read_at !== null,
            'created_at' => $n->created_at?->toIso8601String(),
        ];
    }
}
