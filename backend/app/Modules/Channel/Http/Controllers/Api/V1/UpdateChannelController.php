<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Modules\Channel\Http\Resources\ChannelResource;

#[Group('Channels', weight: 35)]
class UpdateChannelController extends Controller
{
    public function __invoke(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user('sanctum');

        if (! $channel->isOwnedBy($user)) {
            return response()->json(['message' => 'Изменять канал может только владелец.'], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:3', 'max:60'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'category' => ['sometimes', 'nullable', 'string', 'max:120'],
            'kind' => ['sometimes', Rule::in(['brand', 'shop', 'author', 'expert'])],
            'comments_enabled' => ['sometimes', 'boolean'],
            'rules' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'contacts' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'slug' => [
                'sometimes',
                'required',
                'string',
                'min:3',
                'max:80',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('channels', 'slug')->ignore($channel->id),
            ],
        ]);

        if ($channel->kind === 'official' && array_key_exists('kind', $data)) {
            unset($data['kind']);
        }

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $updates['description'] = $data['description'] !== null ? trim($data['description']) : null;
        }
        if (array_key_exists('category', $data)) {
            $updates['category'] = $data['category'] !== null ? trim($data['category']) : null;
        }
        if (array_key_exists('kind', $data)) {
            $updates['kind'] = $data['kind'];
        }
        if (array_key_exists('comments_enabled', $data)) {
            $updates['comments_enabled'] = (bool) $data['comments_enabled'];
        }
        if (array_key_exists('rules', $data)) {
            $updates['rules'] = $data['rules'] !== null ? trim($data['rules']) : null;
        }
        if (array_key_exists('contacts', $data)) {
            $updates['contacts'] = $data['contacts'] !== null ? trim($data['contacts']) : null;
        }
        if (array_key_exists('slug', $data)) {
            $updates['slug'] = $data['slug'];
        }

        if ($updates !== []) {
            $channel->update($updates);
        }

        $channel->load(['owner.profile.avatar', 'avatar', 'banner']);
        $channel->is_subscribed = $channel->subscribers()->whereKey($user->id)->exists();

        return (new ChannelResource($channel))->response();
    }

    private function findChannel(string $slug): Channel
    {
        $channel = Channel::query()->where('slug', $slug)->first();

        if (! $channel && Str::isUuid($slug)) {
            $channel = Channel::query()->where('uuid', $slug)->first();
        }

        if (! $channel) {
            abort(404, 'Канал не найден.');
        }

        return $channel;
    }
}
