<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Models\Post;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;
use Modules\Feed\Http\Resources\PostResource;
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

        $items = Post::query()
            ->with(['author.profile', 'category', 'community'])
            ->when(ContentStatus::tryFrom($status), fn ($query, $s) => $query->where('status', $s))
            ->when($q !== '', fn ($query) => $query->where('title', 'ilike', '%'.$q.'%'))
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return PostResource::collection($items);
    }

    #[Endpoint(title: 'Изменить статус публикации')]
    #[PathParameter('uuid', description: 'UUID публикации')]
    #[BodyParameter('status', description: 'Новый статус', example: 'hidden')]
    public function update(string $uuid, AuditService $audit): PostResource
    {
        $post = Post::query()->where('uuid', $uuid)->first();

        if (! $post) {
            throw new NotFoundHttpException('Публикация не найдена.');
        }

        $data = request()->validate([
            'status' => ['required', Rule::enum(ContentStatus::class)],
        ]);

        $old = $post->toArray();
        $status = ContentStatus::from($data['status']);

        $post->status = $status;
        if ($status === ContentStatus::Published && $post->published_at === null) {
            $post->published_at = now();
        }
        $post->moderated_by = request()->user()->id;
        $post->moderated_at = now();
        $post->save();

        $audit->log(request()->user(), 'admin.posts.update', $post, $old, $post->fresh()->toArray(), request());

        return new PostResource($post->fresh(['author.profile', 'category', 'community']));
    }

    #[PathParameter('uuid', description: 'UUID публикации')]
    public function destroy(string $uuid, AuditService $audit): JsonResponse
    {
        $post = Post::query()->where('uuid', $uuid)->first();

        if (! $post) {
            throw new NotFoundHttpException('Публикация не найдена.');
        }

        $post->delete();
        $audit->log(request()->user(), 'admin.posts.delete', $post, $post->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Публикация удалена.']]);
    }
}
