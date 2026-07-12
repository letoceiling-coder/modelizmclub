<?php

namespace Modules\Account\Services;

use App\Models\User;
use App\Models\UserDocumentRequisites;

class DocumentRequisitesService
{
    /** @return array<string, string|null> */
    public function show(User $user): array
    {
        $row = UserDocumentRequisites::query()->find($user->id);

        return [
            'full_name' => $row?->full_name ?? '',
            'inn' => $row?->inn ?? '',
            'phone' => $row?->phone ?? '',
            'address' => $row?->address ?? '',
        ];
    }

    /** @param array<string, string|null> $data */
    public function update(User $user, array $data): array
    {
        UserDocumentRequisites::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'full_name' => $data['full_name'] ?? null,
                'inn' => $data['inn'] ?? null,
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
            ],
        );

        return $this->show($user);
    }
}
