<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EntityRequestResource;
use App\Models\Media;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Channel\Services\ChannelApplicationService;

#[Group('Channels', weight: 35)]
class ApplyChannelController extends Controller
{
    public function __invoke(Request $request, ChannelApplicationService $applications): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:120'],
            'avatar_media_uuid' => ['nullable', 'uuid'],
            'banner_media_uuid' => ['nullable', 'uuid'],
        ]);

        $user = $request->user();

        $application = $applications->apply(
            user: $user,
            name: $data['name'],
            description: $data['description'] ?? null,
            category: $data['category'] ?? null,
            avatarMediaId: self::resolveOwnedMediaId($user, $data['avatar_media_uuid'] ?? null, 'avatar_media_uuid'),
            bannerMediaId: self::resolveOwnedMediaId($user, $data['banner_media_uuid'] ?? null, 'banner_media_uuid'),
        );

        $application->load('user.profile');

        return response()->json([
            'data' => new EntityRequestResource($application),
        ], 201);
    }

    private static function resolveOwnedMediaId(User $user, ?string $uuid, string $field): ?int
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
