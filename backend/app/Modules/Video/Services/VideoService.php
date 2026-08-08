<?php

namespace Modules\Video\Services;

use App\Models\Comment;
use App\Models\Media;
use App\Models\ModerationQueue;
use App\Models\User;
use App\Models\Video;
use App\Models\VideoCategory;
use App\Models\VideoReaction;
use App\Models\VideoView;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class VideoService
{
    /** @param array<string, mixed> $filters */
    public function list(array $filters, ?User $viewer, int $perPage = 50): LengthAwarePaginator
    {
        $query = Video::query()
            ->with(['category', 'poster', 'videoMedia', 'uploader.profile.avatar']);

        if (! empty($filters['q'])) {
            $q = '%'.$filters['q'].'%';
            $query->where(function ($w) use ($q): void {
                $w->where('title', 'like', $q)
                    ->orWhere('description', 'like', $q);
            });
        }

        if (! empty($filters['category'])) {
            $query->whereHas('category', fn ($c) => $c->where('slug', $filters['category']));
        }

        if (! empty($filters['featured'])) {
            $query->where('is_featured', true);
        }

        return $query
            ->where('status', 'published')
            ->orderByDesc('published_at')
            ->paginate($perPage)
            ->through(fn (Video $video) => $this->attachViewerState($video, $viewer));
    }

    /** @param array<string, mixed> $filters */
    public function adminList(array $filters, int $perPage = 50): LengthAwarePaginator
    {
        $query = Video::query()
            ->with(['category', 'poster', 'videoMedia', 'uploader.profile.avatar']);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['q'])) {
            $q = '%'.$filters['q'].'%';
            $query->where(function ($w) use ($q): void {
                $w->where('title', 'like', $q)
                    ->orWhere('description', 'like', $q);
            });
        }

        return $query
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function adminShow(string $uuid): Video
    {
        $video = Video::query()
            ->with(['category', 'poster', 'videoMedia', 'uploader.profile.avatar'])
            ->where('uuid', $uuid)
            ->first();

        if (! $video) {
            throw new NotFoundHttpException('Видео не найдено.');
        }

        return $video;
    }

    /** @param array<string, mixed> $data */
    public function adminUpdate(Video $video, array $data): Video
    {
        if (array_key_exists('status', $data) && $data['status'] !== null) {
            $video->status = $data['status'];
            if ($data['status'] === 'published' && ! $video->published_at) {
                $video->published_at = now();
            }
        }

        if (array_key_exists('is_featured', $data)) {
            $video->is_featured = (bool) $data['is_featured'];
        }

        $video->save();

        return $video->fresh(['category', 'poster', 'videoMedia', 'uploader.profile.avatar']);
    }

    public function schedule(Video $video, User $user, \DateTimeInterface $scheduledAt): Video
    {
        $this->assertCanManage($video, $user);

        if ($scheduledAt <= now()) {
            throw ValidationException::withMessages([
                'scheduled_at' => ['Время публикации должно быть в будущем.'],
            ]);
        }

        $video->update([
            'status' => 'scheduled',
            'scheduled_at' => $scheduledAt,
            'published_at' => null,
        ]);

        return $video->fresh(['category', 'poster', 'videoMedia', 'uploader.profile.avatar']);
    }

    public function cancelSchedule(Video $video, User $user): Video
    {
        $this->assertCanManage($video, $user);

        if ($video->status !== 'scheduled') {
            throw ValidationException::withMessages([
                'video' => ['Обзор не запланирован.'],
            ]);
        }

        $video->update([
            'status' => 'processing',
            'scheduled_at' => null,
        ]);

        return $video->fresh(['category', 'poster', 'videoMedia', 'uploader.profile.avatar']);
    }

    public function publishDueScheduled(): int
    {
        $due = Video::query()
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->get();

        foreach ($due as $video) {
            $video->update([
                'status' => 'published',
                'published_at' => now(),
                'scheduled_at' => null,
            ]);
        }

        return $due->count();
    }

    public function show(string $uuid, ?User $viewer): Video
    {
        $video = Video::query()
            ->with(['category', 'poster', 'videoMedia', 'uploader.profile.avatar'])
            ->where('uuid', $uuid)
            ->where('status', 'published')
            ->first();

        if (! $video) {
            throw new NotFoundHttpException('Видео не найдено.');
        }

        return $this->attachViewerState($video, $viewer);
    }

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Video
    {
        $category = VideoCategory::query()->where('uuid', $data['category_id'])->first();
        if (! $category) {
            throw ValidationException::withMessages(['category_id' => ['Категория не найдена.']]);
        }

        $posterId = null;
        $posterUuid = trim((string) ($data['poster_media_id'] ?? ''));
        if ($posterUuid !== '') {
            $posterId = $this->ownedMedia($user, $posterUuid, ['post', 'listing', 'avatar', 'cover'])->id;
        }

        $videoMedia = $this->ownedMedia($user, $data['video_media_id'], ['post', 'post_video', 'review_video']);

        $autoPublish = $user->isAdmin();

        $video = Video::query()->create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'category_id' => $category->id,
            'poster_media_id' => $posterId,
            'video_media_id' => $videoMedia->id,
            'duration_seconds' => (int) ($videoMedia->duration_seconds ?? 0),
            'tags' => $data['tags'] ?? [],
            'is_featured' => (bool) ($data['is_featured'] ?? false),
            'uploader_id' => $user->id,
            'status' => $autoPublish ? 'published' : 'processing',
            'published_at' => $autoPublish ? now() : null,
        ]);

        if (! $autoPublish) {
            ModerationQueue::query()->updateOrCreate(
                [
                    'moderatable_type' => Video::class,
                    'moderatable_id' => $video->id,
                ],
                [
                    'queue' => 'videos',
                    'priority' => 0,
                    'status' => 'pending',
                ],
            );
        }

        return $video;
    }

    public function update(Video $video, User $user, array $data): Video
    {
        $this->assertCanManage($video, $user);

        if (array_key_exists('is_featured', $data)) {
            $video->is_featured = (bool) $data['is_featured'];
        }

        $video->save();

        return $video->fresh(['category', 'poster', 'videoMedia', 'uploader.profile.avatar']);
    }

    public function delete(Video $video, User $user): void
    {
        $this->assertCanManage($video, $user);
        $video->delete();
    }

    public function recordView(Video $video, ?User $viewer): void
    {
        $key = $viewer ? 'u'.$viewer->id : 'ip'.request()->ip();
        $cacheKey = 'vv:'.$video->id.':'.$key;

        if (! Cache::add($cacheKey, 1, now()->addMinutes(30))) {
            return;
        }

        VideoView::query()->create([
            'video_id' => $video->id,
            'user_id' => $viewer?->id,
            'viewer_key' => $key,
            'viewed_at' => now(),
        ]);

        $video->increment('views_count');
    }

    public function react(Video $video, User $user, string $type = 'like'): void
    {
        if (! in_array($type, ['like', 'dislike'], true)) {
            $type = 'like';
        }

        $existing = VideoReaction::query()
            ->where('video_id', $video->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->type === $type) {
                return;
            }

            $this->decrementReactionCounter($video, $existing->type);
            $existing->update(['type' => $type]);
            $this->incrementReactionCounter($video, $type);

            return;
        }

        VideoReaction::query()->create([
            'video_id' => $video->id,
            'user_id' => $user->id,
            'type' => $type,
        ]);
        $this->incrementReactionCounter($video, $type);
    }

    public function unreact(Video $video, User $user): void
    {
        $existing = VideoReaction::query()
            ->where('video_id', $video->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $existing) {
            return;
        }

        $this->decrementReactionCounter($video, $existing->type);
        $existing->delete();
    }

    public function listComments(Video $video, int $perPage = 50): LengthAwarePaginator
    {
        return Comment::query()
            ->with(['author.profile.avatar', 'replies.author.profile.avatar'])
            ->where('commentable_type', Video::class)
            ->where('commentable_id', $video->id)
            ->whereNull('parent_id')
            ->where('status', 'published')
            ->orderBy('created_at')
            ->paginate($perPage);
    }

    public function addComment(Video $video, User $user, string $body, ?string $parentUuid = null): Comment
    {
        $parent = null;
        if ($parentUuid) {
            $parent = Comment::query()->where('uuid', $parentUuid)->first();
        }

        $comment = Comment::query()->create([
            'commentable_type' => Video::class,
            'commentable_id' => $video->id,
            'user_id' => $user->id,
            'parent_id' => $parent?->id,
            'root_id' => $parent?->root_id ?? $parent?->id,
            'depth' => $parent ? $parent->depth + 1 : 0,
            'body' => $body,
            'status' => 'published',
        ]);

        $video->increment('comments_count');

        return $comment->load(['author.profile.avatar']);
    }

    private function ownedMedia(User $user, string $uuid, array $purposes = ['post', 'listing', 'avatar']): Media
    {
        $media = Media::query()
            ->where('uuid', $uuid)
            ->where('uploaded_by', $user->id)
            ->first();

        if (! $media || ! in_array($media->purpose, array_merge($purposes, ['review_video']), true)) {
            throw ValidationException::withMessages([
                'media' => ['Медиафайл недоступен.'],
            ]);
        }

        return $media;
    }

    private function assertCanManage(Video $video, User $user): void
    {
        if ($video->uploader_id !== $user->id && ! $user->isAdmin()) {
            throw ValidationException::withMessages([
                'video' => ['Недостаточно прав.'],
            ]);
        }
    }

    private function attachViewerState(Video $video, ?User $viewer): Video
    {
        $reaction = $viewer
            ? VideoReaction::query()->where('video_id', $video->id)->where('user_id', $viewer->id)->first()
            : null;

        $video->setAttribute('is_liked', $reaction?->type === 'like');
        $video->setAttribute('is_disliked', $reaction?->type === 'dislike');

        return $video;
    }

    private function incrementReactionCounter(Video $video, string $type): void
    {
        if ($type === 'dislike') {
            $video->increment('dislikes_count');
        } else {
            $video->increment('likes_count');
        }
    }

    private function decrementReactionCounter(Video $video, string $type): void
    {
        if ($type === 'dislike') {
            $video->decrement('dislikes_count');
        } else {
            $video->decrement('likes_count');
        }
    }
}
