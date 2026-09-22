<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Models\ChannelPost;
use App\Models\Post;
use App\Support\CategoryScope;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;
use Modules\Channel\Services\ChannelPostService;
use Modules\Feed\Http\Resources\PostResource;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Content', weight: 45)]
class AdminPostController extends Controller
{
    #[QueryParameter('status', description: 'Фильтр по статусу', required: false, example: 'published')]
    #[QueryParameter('q', description: 'Поиск по заголовку', required: false, example: 'F-16')]
    public function index(): AnonymousResourceCollection
    {
        $status = (string) request()->query('status', '');
        $q = trim((string) request()->query('q', ''));

        $scope = CategoryScope::for(request()->user());

        $items = Post::query()
            ->with(['author.profile', 'category', 'community', 'mediaItems.media'])
            // Администратор направления — только свои направления.
            ->when($scope !== null, fn ($query) => $scope->constrainPosts($query))
            ->when(ContentStatus::tryFrom($status), fn ($query, $s) => $query->where('status', $s))
            ->when($q !== '', fn ($query) => $query->where('title', 'ilike', '%'.$q.'%'))
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return PostResource::collection($items);
    }

    #[Endpoint(title: 'Изменить статус публикации')]
    #[PathParameter('uuid', description: 'UUID публикации')]
    #[BodyParameter('status', description: 'Новый статус', example: 'hidden')]
    public function update(string $uuid, AuditService $audit, ChannelPostService $channelPosts): PostResource
    {
        $post = Post::query()->where('uuid', $uuid)->first();
        $scope = $this->assertReachable($post);

        $data = request()->validate([
            'status' => ['required', Rule::enum(ContentStatus::class)],
        ]);
        if ($scope !== null && ! in_array($data['status'], CategoryScope::POST_STATUSES, true)) {
            abort(422, 'Администратор направления публикует, снимает, отклоняет и возвращает на доработку.');
        }

        $old = $post->toArray();
        $status = ContentStatus::from($data['status']);

        $post->status = $status;
        if ($status === ContentStatus::Published && $post->published_at === null) {
            $post->published_at = now();
        }
        $post->moderated_by = request()->user()->id;
        $post->moderated_at = now();
        $post->save();

        $this->syncLinkedChannelPost($channelPosts, $post, $status);

        $audit->log(request()->user(), 'admin.posts.update', $post, $old, $post->fresh()->toArray(), request());

        return new PostResource($post->fresh(['author.profile', 'category', 'community', 'mediaItems.media']));
    }

    private function syncLinkedChannelPost(ChannelPostService $channelPosts, Post $post, ContentStatus $status): void
    {
        $channelPost = ChannelPost::query()->where('feed_post_id', $post->id)->first();

        if (! $channelPost) {
            return;
        }

        if ($status === ContentStatus::Published && $channelPost->status !== 'published') {
            $channelPosts->publish($channelPost);
        } elseif ($status === ContentStatus::Rejected && $channelPost->status !== 'rejected') {
            $channelPosts->reject($channelPost);
        }
    }

    #[PathParameter('uuid', description: 'UUID публикации')]
    public function destroy(string $uuid, AuditService $audit): JsonResponse
    {
        $post = Post::query()->where('uuid', $uuid)->first();
        $this->assertReachable($post);

        $post->delete();
        $audit->log(request()->user(), 'admin.posts.delete', $post, $post->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Публикация удалена.']]);
    }

    /**
     * Публикация есть и она в зоне ответственности этого сотрудника.
     *
     * Два разных ответа на два разных случая. До 22.09 оба были «не
     * найдено», и администратор направления читал отказ как поломку: он
     * только что видел эту запись в ленте.
     *
     * Возвращает область видимости: вызывающему она нужна дальше, чтобы
     * ограничить набор решений, и считать её второй раз незачем.
     *
     * @throws NotFoundHttpException публикации нет вовсе
     * @throws AccessDeniedHttpException публикация есть, но не его
     */
    private function assertReachable(?Post $post): ?CategoryScope
    {
        if (! $post) {
            throw new NotFoundHttpException('Публикация не найдена.');
        }

        $scope = CategoryScope::for(request()->user());
        if ($scope !== null && ! $scope->allowsPost($post)) {
            throw new AccessDeniedHttpException(
                'Публикация вне ваших направлений — её ведёт другой администратор.',
            );
        }

        return $scope;
    }
}
