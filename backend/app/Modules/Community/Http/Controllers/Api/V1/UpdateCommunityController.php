<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunityCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityService;

class UpdateCommunityController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();

        if (! $community->isOwnedBy($user)) {
            return response()->json(['message' => 'Изменять сообщество может только владелец.'], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:40'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'category_id' => ['sometimes', 'required', 'integer'],
        ]);

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $updates['description'] = $data['description'] !== null ? trim($data['description']) : null;
        }
        if (array_key_exists('category_id', $data)) {
            $categoryId = (int) $data['category_id'];
            if (! CommunityCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
                throw ValidationException::withMessages([
                    'category_id' => ['Выберите действующую категорию.'],
                ]);
            }
            $updates['category_id'] = $categoryId;
        }

        if ($updates !== []) {
            $communities->submitRevision($community, $updates);
        }

        $community = $communities->show($slug, $user);

        return (new CommunityResource($community))
            ->additional(['message' => 'Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.'])
            ->response();
    }
}
