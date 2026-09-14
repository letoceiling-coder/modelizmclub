<?php

namespace Modules\Admin\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditService
{
    /** @param  array<string, mixed>|null  $old */
    /** @param  array<string, mixed>|null  $new */
    public function log(
        ?User $user,
        string $action,
        ?Model $auditable = null,
        ?array $old = null,
        ?array $new = null,
        ?Request $request = null,
    ): AuditLog {
        return AuditLog::query()->create([
            'user_id' => $user?->id,
            'action' => $action,
            'auditable_type' => $auditable ? $auditable::class : null,
            'auditable_id' => $auditable?->getKey(),
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            // Время ставит приложение, а не база: значение колонки по умолчанию
            // (CURRENT_TIMESTAMP) пишется в поясе сессии Postgres — UTC, — и
            // журнал отставал на три часа от всех остальных записей.
            'created_at' => now(),
        ]);
    }
}
