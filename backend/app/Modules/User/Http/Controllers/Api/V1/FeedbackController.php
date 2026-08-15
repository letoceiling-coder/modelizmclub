<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'guest_email' => [
                Rule::requiredIf($user === null),
                'nullable',
                'email',
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

        return response()->json([
            'data' => [
                'id' => $feedback->id,
                'status' => $feedback->status,
            ],
        ], 201);
    }
}
