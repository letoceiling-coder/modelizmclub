<?php

namespace Modules\Admin\Services;

use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\Listing;
use App\Models\ModerationAction;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\User;
use App\Models\Video;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Support\ModeratableResolver;
use Modules\Channel\Services\ChannelPostService;
use Modules\Feed\Services\PostService;
use Modules\Listing\Services\ListingService;

class ModerationService
{
    public function __construct(
        private readonly ModeratableResolver $resolver,
        private readonly PostService $posts,
        private readonly ListingService $listings,
        private readonly ChannelPostService $channelPosts,
    ) {}

    public function queue(?string $status = null, ?string $queue = null, int $perPage = 20): LengthAwarePaginator
    {
        $this->cancelOrphanedEntries();

        return ModerationQueue::query()
            ->whereHas('moderatable')
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
            } elseif ($model instanceof Listing) {
                $this->listings->markPublished($model);
            } elseif ($model instanceof Community) {
                app(\Modules\Community\Services\CommunityService::class)->applyPendingRevision($model);
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
            } elseif ($model instanceof ChannelPost) {
                $model = $this->channelPosts->publish($model);
            }

            $this->logAction($model, $actor, 'approve');

            return $this->notifyDecision($model->fresh() ?? $model, 'approved');
        });
    }

    public function reject(string $type, string $id, User $actor, ?string $reason = null): Model
    {
        return DB::transaction(function () use ($type, $id, $actor, $reason): Model {
            $model = $this->resolver->resolve($type, $id);

            if ($model instanceof Post) {
                $model->update([
                    'status' => ContentStatus::Rejected,
                    'rejection_reason' => $reason,
                ]);
            } elseif ($model instanceof Listing) {
                $model->update([
                    'status' => ListingStatus::Rejected,
                    'rejection_reason' => $reason,
                ]);
            } elseif ($model instanceof Community) {
                $settings = $model->settings ?? [];
                if ($reason) {
                    $settings['moderation_rejection_reason'] = $reason;
                }
                $model->update([
                    'status' => CommunityStatus::Blocked,
                    'settings' => $settings,
                ]);
            } elseif ($model instanceof Video) {
                $model->update(['status' => 'rejected']);
            } elseif ($model instanceof ChannelPost) {
                $model = $this->channelPosts->reject($model, $reason);
            }

            if (! $model instanceof ChannelPost) {
                $this->updateQueue($model, 'rejected');
            }
            $this->logAction($model, $actor, 'reject', $reason);

            return $this->notifyDecision($model->fresh() ?? $model, 'rejected', $reason);
        });
    }

    public function requestRevision(string $type, string $id, User $actor, ?string $comment = null): Model
    {
        return DB::transaction(function () use ($type, $id, $actor, $comment): Model {
            $model = $this->resolver->resolve($type, $id);

            if ($model instanceof Post) {
                $model->update([
                    'status' => ContentStatus::Revision,
                    'rejection_reason' => $comment,
                ]);
            } elseif ($model instanceof Listing) {
                $model->update([
                    'status' => ListingStatus::Revision,
                    'rejection_reason' => $comment,
                ]);
            } elseif ($model instanceof Video) {
                $model->update(['status' => 'processing']);
            } elseif ($model instanceof Community) {
                $settings = $model->settings ?? [];
                if ($comment) {
                    $settings['moderation_revision_comment'] = $comment;
                }
                $model->update(['settings' => $settings]);
            }

            $this->updateQueue($model, 'revision');
            $this->logAction($model, $actor, 'revision', $comment);

            return $this->notifyDecision($model->fresh() ?? $model, 'revision', $comment);
        });
    }

    private function notifyDecision(Model $model, string $decision, ?string $reason = null): Model
    {
        [$owner, $type, $title, $link] = $this->decisionTarget($model, $decision);
        if ($owner instanceof User) {
            InAppNotify::sendQuiet(
                $owner,
                new InAppNotification($type, $title, (string) ($reason ?? ''), $link),
            );
        }

        return $model;
    }

    /** @return array{0: ?User, 1: string, 2: string, 3: string} */
    private function decisionTarget(Model $model, string $decision): array
    {
        $verb = match ($decision) {
            'approved' => 'одобрено',
            'rejected' => 'отклонено',
            default => 'нуждается в доработке',
        };

        if ($model instanceof Post) {
            return [$model->author ?? User::query()->find($model->user_id), 'moderation', 'Публикация '.$verb, '/feed'];
        }
        if ($model instanceof Listing) {
            if ($decision === 'approved') {
                return [null, 'listings', '', ''];
            }

            return [$model->author ?? User::query()->find($model->user_id), 'listings', 'Объявление '.$verb, '/ads/'.$model->uuid];
        }
        if ($model instanceof Community) {
            return [$model->creator ?? User::query()->find($model->created_by), 'moderation', 'Сообщество '.$verb, '/communities'];
        }
        if ($model instanceof Video) {
            return [User::query()->find($model->uploader_id), 'moderation', 'Обзор '.$verb, '/reviews'];
        }
        if ($model instanceof ChannelPost) {
            $model->loadMissing('channel.owner');
            $owner = $model->channel?->owner ?? User::query()->find($model->channel?->owner_id);

            return [$owner, 'moderation', 'Пост канала '.$verb, '/channels'];
        }

        return [null, 'moderation', '', '/feed'];
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

    /** Pending rows whose target was deleted must not block the admin queue. */
    private function cancelOrphanedEntries(): void
    {
        ModerationQueue::query()
            ->where('status', 'pending')
            ->whereDoesntHave('moderatable')
            ->update(['status' => 'cancelled']);
    }
}
