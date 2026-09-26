<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Rules\SafeEmail;
use App\Services\StaffNotify;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

#[Group('Users', weight: 20)]
class FeedbackController extends Controller
{
    /**
     * Submit a feedback message ("Книга жалоб и предложений").
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::guard('sanctum')->user();

        $data = $request->validate([
            'subject' => ['nullable', 'string', 'max:120'],
            'message' => ['required', 'string', 'max:4000'],
            'page' => ['nullable', 'string', 'max:255'],
            // SafeEmail — рядом со стандартным `email`, как на всех прочих
            // полях с адресом извне. Сегодня этот адрес идёт только в текст
            // обращения, а не в заголовок письма, то есть дыра из
            // GHSA-5vg9-5847-vvmq отсюда не достаётся. Но правило одно на все
            // поля, и первый же `Reply-To` на обращение — очевидная будущая
            // правка — сделал бы этот маршрут проходом. Он к тому же открыт.
            'guest_email' => [
                Rule::requiredIf($user === null),
                'nullable',
                'email',
                new SafeEmail,
                'max:255',
            ],
        ]);

        $message = trim($data['message']);
        if ($user === null && ! empty($data['guest_email'])) {
            $message = 'Email: '.$data['guest_email']."\n\n".$message;
        }

        $feedback = Feedback::query()->create([
            'user_id' => $user?->id,
            'subject' => $data['subject'] ?? null,
            'message' => $message,
            'page' => $data['page'] ?? null,
            'status' => 'new',
        ]);

        StaffNotify::send(
            'staff_feedback',
            'Новое обращение',
            Str::limit(trim(($data['subject'] ?? '') !== '' ? $data['subject'].': '.$data['message'] : $data['message']), 140, '…'),
            StaffNotify::LINK_FEEDBACK,
            $user,
        );

        return response()->json([
            'data' => [
                'id' => $feedback->id,
                'status' => $feedback->status,
            ],
        ], 201);
    }
}
