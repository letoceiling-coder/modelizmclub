<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityService;

class UpdateCommunityBrandingController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();

        if (! $community->isOwnedBy($user)) {
            return response()->json(['message' => 'Изменять оформление может только владелец сообщества.'], 403);
        }

        $data = $request->validate([
            'avatar_media_uuid' => ['nullable', 'uuid'],
            'cover_media_uuid' => ['nullable', 'uuid'],
        ]);

        $updates = [];
        if (array_key_exists('avatar_media_uuid', $data)) {
            $updates['avatar_media_id'] = $this->resolveOwnedMediaId(
                $user,
                $data['avatar_media_uuid'],
                'avatar_media_uuid',
            );
        }
        if (array_key_exists('cover_media_uuid', $data)) {
            $updates['cover_media_id'] = $this->resolveOwnedMediaId(
                $user,
                $data['cover_media_uuid'],
                'cover_media_uuid',
            );
        }

        if ($updates !== []) {
            $communities->submitRevision($community, $updates);
        }

        $community = $communities->show($slug, $user);

        return (new CommunityResource($community))
            ->additional(['message' => 'Изменения оформления отправлены на модерацию. После проверки они будут опубликованы автоматически.'])
            ->response();
    }

    private function resolveOwnedMediaId(User $user, ?string $uuid, string $field): ?int
    {
        if ($uuid === null || $uuid === '') {
            return null;
        }

        $media = Media::query()
            ->where('uuid', $uuid)
            ->where('uploaded_by', $user->id)
            ->first();

        if (! $media) {
            throw ValidationException::withMessages([
                $field => ['Изображение недоступно.'],
            ]);
        }

        return $media->id;
    }
}
