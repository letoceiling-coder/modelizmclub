<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\AdminAccess;
use App\Support\RolePrivileges;
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
use Modules\Admin\Services\UserFullDeletionService;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Billing\Services\SubscriptionAccessResolver;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Users', weight: 30)]
class AdminUserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->with(['profile', 'subscriptions'])
            ->when(request()->filled('role'), fn ($q) => $q->where('role', request('role')))
            /*
             * Поиск по имени, почте и телефону.
             *
             * Телефон ищется отдельной веткой, потому что в базе он лежит
             * в том виде, в каком его ввёл человек: «+7 999 123-45-67»,
             * «8(999)1234567», «79991234567» — всё это один номер. Прямое
             * сравнение со строкой не находит ни одного из них, если
             * набрать номер иначе, чем он записан.
             *
             * Поэтому из запроса и из колонки убираются все знаки, кроме
             * цифр, и сравниваются цифры с цифрами. Ведущая восьмёрка
             * приводится к семёрке — тем же правилом, что в
             * `ReferralService::phoneHash`.
             */
            ->when(request()->filled('q'), function ($q): void {
                $запрос = trim((string) request('q'));
                $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $запрос).'%';
                $цифры = preg_replace('/\\D+/', '', $запрос) ?? '';
                if (strlen($цифры) === 11 && str_starts_with($цифры, '8')) {
                    $цифры = '7'.substr($цифры, 1);
                }

                $q->where(function ($w) use ($needle, $цифры): void {
                    $w->where('email', 'ilike', $needle)
                        ->orWhere('name', 'ilike', $needle)
                        ->orWhereHas('profile', fn ($p) => $p->where('display_name', 'ilike', $needle));

                    // Три цифры — нижний порог: по одной-двум в ответ
                    // приедет половина базы, и это не поиск.
                    if (strlen($цифры) >= 3) {
                        $w->orWhereRaw("regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like ?", ['%'.$цифры.'%']);
                    }
                });
            })
            ->when(request()->filled('status'), fn ($q) => $q->where('status', request('status')))
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        /*
         * Прогрев основания доступа на всю страницу — три запроса, сколько бы
         * строк в ней ни было.
         *
         * Без него `UserResource` спрашивал бы резолвер по одному, а тот
         * делает до трёх запросов на человека: при `per_page=20` это шестьдесят
         * лишних, при сотне — триста. Починить ложь в админке и завести взамен
         * N+1 значило бы обменять одну находку аудита 03.10 на другую из того
         * же списка.
         */
        app(SubscriptionAccessResolver::class)->forUsers($users->getCollection());

        return UserResource::collection($users);
    }

    #[Endpoint(title: 'Создать пользователя', description: 'Только Владелец. Пароль хешируется автоматически.')]
    #[BodyParameter('email', example: 'staff@example.com')]
    #[BodyParameter('password', example: 'password123')]
    #[BodyParameter('name', required: false, example: 'Staff User')]
    #[BodyParameter('role', description: 'user|category_admin|moderator|owner', example: 'moderator')]
    #[BodyParameter('status', description: 'active|blocked|pending_verification', example: 'active')]
    public function store(StoreAdminUserRequest $request, AuditService $audit): JsonResponse
    {
        $this->guardStaffRole($request->user(), $request->input('role'));

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

        $this->guardModeratorEdit($request, $user);
        $this->guardLastOwner($request, $user);

        $tracked = ['email', 'name', 'role', 'status', ...RolePrivileges::FIELDS];
        $old = $user->only($tracked);
        // Правила запроса перечисляют ровно то, что можно менять; льготы не
        // входят в fillable модели, чтобы их не задел ни один другой путь.
        // Смена роли сама выставит льготы по умолчанию (User::booted), если
        // в этом же запросе они не заданы явно.
        $user->forceFill($request->validated())
            ->pinPrivileges(array_keys($request->validated()));
        $user->save();

        $audit->log($request->user(), 'admin.users.update', $user, $old, $user->only($tracked), $request);

        return new UserResource($user->fresh('profile'));
    }

    #[PathParameter('uuid', description: 'UUID пользователя (не удаляйте demo/admin — только для теста создайте staff@example.com)', example: SwaggerFixtures::DEMO_USER_UUID)]
    public function destroy(string $uuid, AuditService $audit, UserFullDeletionService $deletion): JsonResponse
    {
        $actor = request()->user();
        $user = User::query()->where('uuid', $uuid)->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        if ($actor !== null && (int) $actor->id === (int) $user->id) {
            abort(422, 'Нельзя удалить собственный аккаунт.');
        }

        // Сотрудника удаляет только Владелец — по той же причине, что и
        // заводит: иначе обладатель раздела учёток сносит Владельцев.
        $this->guardStaffRole($actor, $user->role->value);

        if ($user->role === UserRole::Owner && $this->otherActiveOwnersCount($user) === 0) {
            abort(422, 'Нельзя удалить последнего Владельца.');
        }

        $snapshot = $user->only(['email', 'uuid', 'name']);
        $deletion->purge($user);
        $audit->log($actor, 'admin.users.delete', null, $snapshot, null, request());

        return response()->json(['data' => ['message' => 'Пользователь и все связанные данные удалены.']]);
    }

    /**
     * Prevents demoting or blocking the last remaining active Owner,
     * which would otherwise lock everyone out of the admin panel.
     */
    private function guardLastOwner(UpdateAdminUserRequest $request, User $user): void
    {
        if ($user->role !== UserRole::Owner) {
            return;
        }

        $losesOwnerRole = $request->filled('role') && $request->string('role')->toString() !== UserRole::Owner->value;
        $becomesInactive = $request->filled('status') && $request->string('status')->toString() !== UserStatus::Active->value;

        if (($losesOwnerRole || $becomesInactive) && $this->otherActiveOwnersCount($user) === 0) {
            abort(422, 'Нельзя снять последнего Владельца.');
        }
    }

    private function otherActiveOwnersCount(User $user): int
    {
        return User::query()
            ->where('role', UserRole::Owner)
            ->where('status', UserStatus::Active)
            ->where('id', '!=', $user->id)
            ->count();
    }

    /**
     * Сотрудника заводит и удаляет только Владелец по роли.
     *
     * Раздел «Учётки: создание и удаление» галочкой не выдаётся, но
     * держать это единственной защитой нельзя: список выдаваемого
     * меняется одной строкой, а здесь роль пишется в базу как есть —
     * создав учётку с ролью Владельца, дальше можно всё.
     */
    private function guardStaffRole(?User $actor, mixed $role): void
    {
        if ($role === null || $role === UserRole::User->value || AdminAccess::isOwner($actor)) {
            return;
        }

        abort(403, 'Сотрудника заводит только Владелец.');
    }

    /**
     * Модератор правит обычных пользователей — статус и имя. Роль, почта и
     * пароль, а также любые сотрудники, включая администраторов направлений,
     * — у Владельца (AdminAccess). Администратора направления назначает
     * Владелец, и модератор не должен его блокировать или переименовывать.
     */
    private function guardModeratorEdit(UpdateAdminUserRequest $request, User $target): void
    {
        $actor = $request->user();
        if (AdminAccess::isOwner($actor)) {
            return;
        }
        if ($target->role !== UserRole::User) {
            abort(403, 'Сотрудников правит только Владелец.');
        }
        /*
         * По ключу, а не по роли: право на учётные поля выдаётся и
         * отдельно (C3). Сотрудники выше остаются за ролью Владельца —
         * выдача прав не должна открывать правку других сотрудников.
         *
         * Роль этим правом не открывается. Она стоит в том же списке
         * owner-only полей, но сменой роли выдают Владельца — в том
         * числе себе через вторую учётку. Право на льготы и почту не
         * должно становиться правом раздавать роли.
         */
        if (AdminAccess::allows($actor, 'users.fields')) {
            if ($request->has('role')) {
                abort(403, 'Роль меняет только Владелец.');
            }

            return;
        }
        foreach (AdminAccess::OWNER_ONLY_USER_FIELDS as $field) {
            if ($request->has($field)) {
                abort(403, 'Роль, почту, пароль и льготы меняет Владелец или тот, кому это право выдано.');
            }
        }
    }
}
