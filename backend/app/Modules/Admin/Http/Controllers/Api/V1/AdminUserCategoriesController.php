<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Services\AuditService;
use Modules\Admin\Services\CategoryAdminService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** Направления администратора направления. Только Владелец. */
#[Group('Admin — Users', weight: 30)]
class AdminUserCategoriesController extends Controller
{
    public function __construct(private readonly CategoryAdminService $categories) {}

    #[Endpoint(title: 'Направления администратора')]
    #[PathParameter('uuid', description: 'UUID пользователя')]
    public function show(string $uuid): JsonResponse
    {
        $user = $this->findUser($uuid);

        return response()->json(['data' => [
            'categories' => $this->categories->categoriesOf($user),
            'max_per_category' => CategoryAdminService::maxPerCategory(),
        ]]);
    }

    #[Endpoint(title: 'Назначить направления', description: 'Заменяет список направлений администратора направления.')]
    #[PathParameter('uuid', description: 'UUID пользователя')]
    #[BodyParameter('category_ids', description: 'id направлений (post_categories)', example: [1, 6])]
    public function update(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'category_ids' => ['present', 'array', 'max:50'],
            'category_ids.*' => ['integer'],
        ]);
        $user = $this->findUser($uuid);

        $change = $this->categories->sync($user, $data['category_ids'], $request->user());
        $audit->log($request->user(), 'admin.users.categories', $user, ['removed' => $change['removed']], ['added' => $change['added']], $request);

        return $this->show($uuid);
    }

    private function findUser(string $uuid): User
    {
        $user = User::query()->where('uuid', $uuid)->first();
        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        return $user;
    }
}
