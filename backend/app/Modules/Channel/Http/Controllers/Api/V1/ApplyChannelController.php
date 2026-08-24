<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EntityRequestResource;
use App\Models\Media;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Modules\Channel\Services\ChannelApplicationService;

#[Group('Channels', weight: 35)]
class ApplyChannelController extends Controller
{
    public function __invoke(Request $request, ChannelApplicationService $applications): JsonResponse
    {
        $user = $request->user();

        if (! self::canApply($user)) {
            return response()->json([
                'message' => 'Создать канал могут пользователи с активной подпиской или подтверждённым аккаунтом.',
            ], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:60'],
            'slug' => [
                'nullable',
                'string',
                'min:3',
                'max:80',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('channels', 'slug'),
            ],
            'description' => ['nullable', 'string', 'max:5000'],
            'category' => ['nullable', 'string', 'max:120'],
            'kind' => ['nullable', Rule::in(['brand', 'shop', 'author', 'expert'])],
            'comments_enabled' => ['sometimes', 'boolean'],
            'avatar_media_uuid' => ['nullable', 'uuid'],
            'banner_media_uuid' => ['nullable', 'uuid'],
        ]);

        $application = $applications->apply(
            user: $user,
            name: $data['name'],
            description: $data['description'] ?? null,
            category: $data['category'] ?? null,
            avatarMediaId: self::resolveOwnedMediaId($user, $data['avatar_media_uuid'] ?? null, 'avatar_media_uuid'),
            bannerMediaId: self::resolveOwnedMediaId($user, $data['banner_media_uuid'] ?? null, 'banner_media_uuid'),
            slug: $data['slug'] ?? null,
            kind: $data['kind'] ?? null,
            commentsEnabled: array_key_exists('comments_enabled', $data) ? (bool) $data['comments_enabled'] : true,
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

    private static function canApply(User $user): bool
    {
        if (method_exists($user, 'isModerator') && $user->isModerator()) {
            return true;
        }

        if ($user->hasActiveSubscription()) {
            return true;
        }

        return $user->phone_verified_at !== null;
    }
}
