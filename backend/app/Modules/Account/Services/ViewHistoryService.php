<?php

namespace Modules\Account\Services;

use App\Models\User;
use App\Models\UserViewHistory;

class ViewHistoryService
{
    /** @return array{data: list<array<string, mixed>>} */
    public function list(User $user, int $perPage = 50): array
    {
        $rows = UserViewHistory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('viewed_at')
            ->limit($perPage)
            ->get();

        return [
            'data' => $rows->map(fn (UserViewHistory $row) => [
                'id' => (string) $row->id,
                'kind' => $row->kind,
                'title' => $row->title,
                'thumb' => $row->thumb,
                'viewed_at' => $row->viewed_at->toIso8601String(),
            ])->all(),
        ];
    }

    public function record(User $user, string $id, string $kind, ?string $title = null, ?string $thumb = null): void
    {
        UserViewHistory::query()->updateOrCreate(
            ['user_id' => $user->id, 'kind' => $kind, 'target_uuid' => $id],
            [
                'title' => $title ?? $id,
                'thumb' => $thumb,
                'viewed_at' => now(),
            ],
        );
    }
}
