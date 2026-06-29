<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
     * Update a feedback item's status (new | read | resolved).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:new,read,resolved'],
        ]);

        $feedback = Feedback::query()->findOrFail($id);
        $feedback->update(['status' => $data['status']]);

        return response()->json(['data' => ['id' => $feedback->id, 'status' => $feedback->status]]);
    }
}
