<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Modules\Admin\Http\Requests\StoreAdminUserRequest;
use Modules\Admin\Http\Requests\UpdateAdminUserRequest;
use Modules\Admin\Services\AuditService;
use Modules\Auth\Http\Resources\UserResource;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Users', weight: 30)]
class AdminUserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->with('profile')
            ->when(request()->filled('role'), fn ($q) => $q->where('role', request('role')))
            ->when(request()->filled('status'), fn ($q) => $q->where('status', request('status')))
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return UserResource::collection($users);
    }

    #[Endpoint(title: 'Создать пользователя', description: 'Только admin. Пароль хешируется автоматически.')]
    #[BodyParameter('email', example: 'staff@example.com')]
    #[BodyParameter('password', example: 'password123')]
    #[BodyParameter('name', required: false, example: 'Staff User')]
    #[BodyParameter('role', description: 'user|subscriber|moderator|admin', example: 'moderator')]
    #[BodyParameter('status', description: 'active|blocked|pending_verification', example: 'active')]
    public function store(StoreAdminUserRequest $request, AuditService $audit): JsonResponse
    {
        $user = User::query()->create([
            'uuid' => (string) Str::uuid(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
            'name' => $request->input('name'),
            'role' => $request->input('role'),
            'status' => $request->input('status'),
        ]);

        $audit->log($request->user(), 'admin.users.create', $user, null, $user->only(['email', 'role', 'status']), $request);

        return (new UserResource($user->load('profile')))
            ->response()
            ->setStatusCode(201);
    }

    #[PathParameter('uuid', description: 'UUID пользователя (demo после seed)', example: SwaggerFixtures::DEMO_USER_UUID)]
    public function show(string $uuid): UserResource
    {
        $user = User::query()->with('profile')->where('uuid', $uuid)->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        return new UserResource($user);
    }

    #[PathParameter('uuid', description: 'UUID пользователя', example: SwaggerFixtures::DEMO_USER_UUID)]
    #[BodyParameter('name', required: false, example: 'Demo User Updated')]
    #[BodyParameter('status', required: false, example: 'active')]
    public function update(UpdateAdminUserRequest $request, string $uuid, AuditService $audit): UserResource
    {
        $user = User::query()->where('uuid', $uuid)->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        $old = $user->only(['email', 'name', 'role', 'status']);
        $user->fill($request->validated());
        $user->save();

        $audit->log($request->user(), 'admin.users.update', $user, $old, $user->only(['email', 'name', 'role', 'status']), $request);

        return new UserResource($user->fresh('profile'));
    }

    #[PathParameter('uuid', description: 'UUID пользователя (не удаляйте demo/admin — только для теста создайте staff@example.com)', example: SwaggerFixtures::DEMO_USER_UUID)]
    public function destroy(string $uuid, AuditService $audit): JsonResponse
    {
        $user = User::query()->where('uuid', $uuid)->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        $user->delete();
        $audit->log(request()->user(), 'admin.users.delete', $user, $user->only(['email', 'uuid']), null, request());

        return response()->json(['data' => ['message' => 'Пользователь удалён.']]);
    }
}
