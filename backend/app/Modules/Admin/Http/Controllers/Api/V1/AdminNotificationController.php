<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Services\NotificationPolicy;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Services\AuditService;

#[Group('Admin — Notifications', weight: 70)]
class AdminNotificationController extends Controller
{
    #[Endpoint(title: 'Рассылка уведомления', description: 'Отправляет in-app уведомление всем активным пользователям.')]
    #[BodyParameter('title', example: 'Новое мероприятие')]
    #[BodyParameter('body', required: false, example: 'Подробности на странице события.')]
    #[BodyParameter('link', required: false, example: '/feed')]
    public function __invoke(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'body' => ['nullable', 'string', 'max:1000'],
            'link' => ['nullable', 'string', 'max:255'],
        ]);

        $sent = 0;
        User::query()
            ->where('status', UserStatus::Active)
            ->chunkById(500, function ($users) use ($data, &$sent): void {
                foreach ($users as $user) {
                    if (! NotificationPolicy::allows($user, 'promo', 'in_app')) {
                        continue;
                    }
                    InAppNotify::sendQuiet(
                        $user,
                        new InAppNotification(
                            type: 'promo',
                            title: $data['title'],
                            body: $data['body'] ?? '',
                            link: $data['link'] ?? null,
                        ),
                    );
                    $sent++;
                }
            });

        $audit->log($request->user(), 'admin.notifications.broadcast', null, null, [
            'title' => $data['title'],
            'sent' => $sent,
        ], $request);

        return response()->json(['data' => ['message' => "Отправлено получателям: {$sent}", 'sent' => $sent]]);
    }
}
