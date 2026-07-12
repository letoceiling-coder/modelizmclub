<?php

namespace Modules\Admin\Services;

use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Models\Community;
use App\Models\ModerationAction;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\User;
use App\Models\Video;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Support\ModeratableResolver;
use Modules\Feed\Services\PostService;

class ModerationService
{
    public function __construct(
        private readonly ModeratableResolver $resolver,
        private readonly PostService $posts,
    ) {}

    public function queue(?string $status = null, ?string $queue = null, int $perPage = 20): LengthAwarePaginator
    {
        return ModerationQueue::query()
            ->with(['moderatable', 'assignee.profile'])
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($queue, fn ($q) => $q->where('queue', $queue))
            ->orderByDesc('priority')
            ->orderBy('created_at')
            ->paginate($perPage);
    }

    public function approve(string $type, string $id, User $actor): Model
    {
        return DB::transaction(function () use ($type, $id, $actor): Model {
            $model = $this->resolver->resolve($type, $id);

            if ($model instanceof Post) {
                $this->posts->markPublished($model);
            } elseif ($model instanceof Community) {
                $model->update([
                    'status' => CommunityStatus::Active,
                    'approved_at' => now(),
                ]);
                $this->updateQueue($model, 'approved');
            } elseif ($model instanceof Video) {
                $model->update([
                    'status' => 'published',
                    'published_at' => $model->published_at ?? now(),
                ]);
                $this->updateQueue($model, 'approved');
            }

            $this->logAction($model, $actor, 'approve');

            return $model->fresh();
        });
    }

    public function reject(string $type, string $id, User $actor, ?string $reason = null): Model
    {
        return DB::transaction(function () use ($type, $id, $actor, $reason): Model {
            $model = $this->resolver->resolve($type, $id);

            if ($model instanceof Post) {
                $model->update(['status' => ContentStatus::Rejected]);
            } elseif ($model instanceof Community) {
                $model->update(['status' => CommunityStatus::Blocked]);
            } elseif ($model instanceof Video) {
                $model->update(['status' => 'rejected']);
            }

            $this->updateQueue($model, 'rejected');
            $this->logAction($model, $actor, 'reject', $reason);

            return $model->fresh();
        });
    }

    public function requestRevision(string $type, string $id, User $actor, ?string $comment = null): Model
    {
        return DB::transaction(function () use ($type, $id, $actor, $comment): Model {
            $model = $this->resolver->resolve($type, $id);

            if ($model instanceof Post) {
                $model->update(['status' => ContentStatus::Revision]);
            } elseif ($model instanceof Video) {
                $model->update(['status' => 'processing']);
            }

            $this->updateQueue($model, 'revision');
            $this->logAction($model, $actor, 'revision', $comment);

            return $model->fresh();
        });
    }

    private function updateQueue(Model $model, string $status): void
    {
        ModerationQueue::query()
            ->where('moderatable_type', $model::class)
            ->where('moderatable_id', $model->getKey())
            ->update(['status' => $status]);
    }

    private function logAction(Model $model, User $actor, string $action, ?string $reason = null): void
    {
        ModerationAction::query()->create([
            'moderatable_type' => $model::class,
            'moderatable_id' => $model->getKey(),
            'actor_id' => $actor->id,
            'action' => $action,
            'reason' => $reason,
        ]);
    }
}
