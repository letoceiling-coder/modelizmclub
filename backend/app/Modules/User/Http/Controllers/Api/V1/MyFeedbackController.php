<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Обращения пользователя и ответы на них.
 *
 * Уведомление сообщает, что ответ есть, но показать его целиком не может:
 * в списке уведомлений текст обрезан двумя строками. Ответ на жалобу в две
 * строки не помещается, поэтому у него есть своё место, куда уведомление и
 * ведёт.
 */
#[Group('Users', weight: 20)]
class MyFeedbackController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $items = Feedback::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $items->map(fn (Feedback $row): array => [
                'id' => $row->id,
                'subject' => $row->subject,
                'message' => $row->message,
                'page' => $row->page,
                'status' => $row->status,
                'reply' => $row->reply,
                'replied_at' => $row->replied_at?->toIso8601String(),
                'created_at' => $row->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }
}
