<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Users', weight: 20)]
class FeedbackController extends Controller
{
    /**
     * Submit a feedback message ("Книга жалоб и предложений").
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['nullable', 'string', 'max:120'],
            'message' => ['required', 'string', 'max:4000'],
            'page' => ['nullable', 'string', 'max:255'],
        ]);

        $feedback = Feedback::query()->create([
            'user_id' => $request->user()?->id,
            'subject' => $data['subject'] ?? null,
            'message' => $data['message'],
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
