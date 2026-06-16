<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Feed\Http\Requests\StorePostRequest;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostService;

#[Group('Feed', weight: 5)]
class StorePostController extends Controller
{
    #[Endpoint(title: 'Создать пост', description: 'Создаёт черновик. Для публикации вызовите `POST /posts/{uuid}/publish`.')]
    #[BodyParameter('title', example: 'Сборка P-51')]
    #[BodyParameter('body', example: 'Прогресс за неделю — крылья и фюзеляж.')]
    #[BodyParameter('category_id', description: 'ID из GET /categories/posts', example: 1)]
    #[BodyParameter('hashtags', description: 'Массив тегов без #', example: '["p51","scale72"]')]
    public function __invoke(StorePostRequest $request, PostService $posts): JsonResponse
    {
        $post = $posts->create($request->user(), $request->validated());

        return (new PostResource($post))
            ->response()
            ->setStatusCode(201);
    }
}
