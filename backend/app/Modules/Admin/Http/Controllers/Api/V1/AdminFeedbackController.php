<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Services\AuditService;

#[Group('Admin', weight: 90)]
class AdminFeedbackController extends Controller
{
    /**
     * List submitted feedback ("Книга жалоб и предложений"), newest first.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Feedback::query()->with('user:id,name')->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $items = $query->paginate((int) $request->integer('per_page', 30));

        return response()->json($items);
    }

    /**
     * Update a feedback item: its status, its reply, or both.
     *
     * Ответ и метка приходят одним запросом, потому что это одно действие
     * сотрудника: он отвечает — и обращение тем самым закрыто. Разделение
     * дало бы два обращения к серверу и состояние «ответ отправлен, а
     * висит как новое» между ними.
     */
    public function update(Request $request, int $id, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'string', 'in:new,read,resolved'],
            'reply' => ['sometimes', 'string', 'min:2', 'max:4000'],
        ]);

        if (! array_key_exists('status', $data) && ! array_key_exists('reply', $data)) {
            return response()->json([
                'message' => 'Нечего менять: укажите статус, ответ или и то и другое.',
            ], 422);
        }

        $feedback = Feedback::query()->findOrFail($id);
        $old = $feedback->only(['status', 'reply']);

        $changes = [];
        $notified = false;

        if (array_key_exists('reply', $data)) {
            $reply = trim($data['reply']);
            $changes['reply'] = $reply;
            $changes['replied_at'] = now();
            $changes['replied_by'] = $request->user()->id;

            /*
             * Отвечает сотрудник — статус закрывается сам.
             *
             * Явный `status` в том же запросе сильнее: сотрудник может
             * ответить уточняющим вопросом и оставить обращение открытым.
             */
            $changes['status'] = $data['status'] ?? 'resolved';
        } elseif (array_key_exists('status', $data)) {
            $changes['status'] = $data['status'];
        }

        $feedback->update($changes);

        if (array_key_exists('reply', $data) && ! $feedback->isFromGuest() && $feedback->user !== null) {
            /*
             * Тип `feedback_reply` намеренно не заведён в карте типов
             * уведомлений.
             *
             * `NotificationPolicy` пропускает незнакомый тип без вопросов, а
             * знакомый проверяет по настройкам. Ближайший заведённый тип —
             * `system`, и он отображён на категорию `promo`: человек,
             * отключивший маркетинг, не увидел бы ответа на собственный
             * вопрос. Ответ на обращение — не рассылка, отключать его нечем
             * и незачем.
             */
            InAppNotify::sendQuiet($feedback->user, new InAppNotification(
                'feedback_reply',
                'Ответ на ваше обращение',
                $feedback->reply ?? '',
                '/settings/feedback',
            ));
            $notified = true;
        }

        $audit->log($request->user(), 'admin.feedback.update', $feedback, $old, $changes, $request);

        return response()->json([
            'data' => [
                'id' => $feedback->id,
                'status' => $feedback->status,
                'reply' => $feedback->reply,
                'replied_at' => $feedback->replied_at?->toIso8601String(),
                'notified' => $notified,
                'from_guest' => $feedback->isFromGuest(),
            ],
        ]);
    }
}
