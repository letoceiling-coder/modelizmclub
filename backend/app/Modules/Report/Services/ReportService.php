<?php

namespace Modules\Report\Services;

use App\Models\Comment;
use App\Models\Listing;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ReportService
{
    /** Допустимые причины жалобы (100% русский интерфейс — ярлыки на фронте). */
    public const REASONS = ['spam', 'offensive', 'adult', 'fraud', 'violence', 'copyright', 'other'];

    /** Допустимые статусы для админской обработки. */
    public const RESOLUTIONS = ['reviewing', 'resolved', 'rejected', 'dismissed'];

    /** Сопоставление типа из запроса и Eloquent-модели. */
    private const TYPES = [
        'post' => Post::class,
        'listing' => Listing::class,
        'comment' => Comment::class,
        'user' => User::class,
    ];

    public function create(User $reporter, string $type, string $targetUuid, string $reason, ?string $description): Report
    {
        $target = $this->resolveTarget($type, $targetUuid);

        // Нельзя жаловаться на самого себя.
        if ($target instanceof User && $target->id === $reporter->id) {
            throw ValidationException::withMessages([
                'target_id' => ['Нельзя пожаловаться на самого себя.'],
            ]);
        }

        $ownerId = $this->targetOwnerId($target);
        if ($ownerId !== null && $ownerId === $reporter->id) {
            throw ValidationException::withMessages([
                'target_id' => ['Нельзя пожаловаться на собственный контент.'],
            ]);
        }

        // Повторная жалоба того же пользователя на тот же объект, пока прежняя не обработана — запрещена.
        $exists = Report::query()
            ->where('reporter_id', $reporter->id)
            ->where('reportable_type', $target::class)
            ->where('reportable_id', $target->getKey())
            ->whereIn('status', ['pending', 'reviewing'])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'target_id' => ['Вы уже отправляли жалобу на этот объект, она на рассмотрении.'],
            ]);
        }

        return Report::create([
            'reporter_id' => $reporter->id,
            'reportable_type' => $target::class,
            'reportable_id' => $target->getKey(),
            'reason' => $reason,
            'description' => $description,
            'status' => 'pending',
        ]);
    }

    public function resolve(Report $report, User $actor, string $status): Report
    {
        if (! in_array($status, self::RESOLUTIONS, true)) {
            throw ValidationException::withMessages([
                'status' => ['Недопустимый статус обработки жалобы.'],
            ]);
        }

        $terminal = in_array($status, ['resolved', 'rejected', 'dismissed'], true);

        $report->update([
            'status' => $status,
            'resolved_by' => $terminal ? $actor->id : null,
            'resolved_at' => $terminal ? now() : null,
        ]);

        return $report->fresh(['reporter', 'resolver']);
    }

    private function resolveTarget(string $type, string $uuid): Model
    {
        $modelClass = self::TYPES[$type] ?? null;

        if ($modelClass === null) {
            throw ValidationException::withMessages([
                'type' => ['Недопустимый тип объекта жалобы.'],
            ]);
        }

        $model = $modelClass::query()->where('uuid', $uuid)->first();

        if (! $model) {
            throw new NotFoundHttpException('Объект жалобы не найден.');
        }

        return $model;
    }

    private function targetOwnerId(Model $target): ?int
    {
        return match (true) {
            $target instanceof Post, $target instanceof Listing, $target instanceof Comment => (int) $target->user_id,
            default => null,
        };
    }
}
