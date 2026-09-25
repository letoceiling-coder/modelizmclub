<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AdminPermissionGrant;
use App\Models\User;
use App\Support\AdminAccess;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Отдельные права сотрудника поверх роли (C3).
 *
 * Роль остаётся умолчанием. Галочка только добавляет раздел: убрать ею
 * то, что даёт роль, нельзя, и в ответе такие разделы помечены `by_role`,
 * чтобы интерфейс показывал их отмеченными и не давал снять.
 *
 * Выдаёт только Владелец **по роли**. Проверка стоит здесь, а не в одном
 * лишь `admin.section:roles`: раздел «Роли и доступ» выдать галочкой
 * нельзя (AdminAccess::grantableKeys), но если когда-нибудь станет
 * можно — получивший его не должен раздавать права дальше.
 */
#[Group('Admin — Roles', weight: 31)]
class AdminUserPermissionsController extends Controller
{
    #[Endpoint(title: 'Выдать и отозвать отдельные права')]
    #[PathParameter('uuid', description: 'UUID сотрудника')]
    #[BodyParameter('sections', description: 'Полный список выданных разделов; чего нет — то отзывается')]
    public function update(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $this->guardOwner($request);
        $target = $this->find($uuid);

        $data = $request->validate([
            'sections' => ['present', 'array'],
            'sections.*' => ['string', 'distinct'],
        ]);

        $просят = array_values(array_unique(array_map('strval', $data['sections'])));
        $лишние = array_diff($просят, AdminAccess::grantableKeys());
        if ($лишние !== []) {
            abort(422, 'Эти права выдать нельзя: '.implode(', ', $лишние));
        }

        $стало = $просят;
        sort($стало);

        /*
         * Чтение и запись — в одной транзакции под блокировкой строк.
         * Иначе две вкладки, меняющие набор одного человека в разные
         * стороны, берут блокировки в обратном порядке: одна удаляет A и
         * вставляет B, другая наоборот, и Postgres снимает одну взаимной
         * блокировкой — человек получает 500 вместо сохранения.
         */
        $было = DB::transaction(function () use ($target, $стало, $request): array {
            $текущие = AdminPermissionGrant::query()
                ->where('user_id', $target->id)
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('section')
                ->map(fn ($s) => (string) $s)
                ->all();
            $было = array_values(array_intersect($текущие, AdminAccess::grantableKeys()));
            sort($было);

            if ($было === $стало) {
                return $было;
            }

            $лишние = AdminPermissionGrant::query()->where('user_id', $target->id);
            if ($стало !== []) {
                $лишние->whereNotIn('section', $стало);
            }
            $лишние->delete();

            if ($стало !== []) {
                /*
                 * Одним `upsert`, а не циклом `firstOrCreate`: две вкладки,
                 * выдающие одно и то же право одновременно, иначе
                 * сталкивались бы на уникальном индексе, и человек получал
                 * бы 500 вместо сохранения.
                 */
                AdminPermissionGrant::query()->upsert(
                    array_map(fn (string $section) => [
                        'user_id' => $target->id,
                        'section' => $section,
                        'granted_by' => $request->user()?->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ], $стало),
                    ['user_id', 'section'],
                    // Только отметка времени: `granted_by` остаётся от
                    // первой выдачи. Обновляй мы его — колонка отвечала бы
                    // не «кто это открыл», а «кто последний трогал набор».
                    ['updated_at'],
                );
            }

            return $было;
        });

        AdminPermissionGrant::forget();

        if ($было === $стало) {
            return response()->json(['data' => $this->present($target)]);
        }

        $audit->log(
            $request->user(),
            'admin.roles.permissions',
            $target,
            ['sections' => $было],
            ['sections' => $стало],
            $request,
        );

        return response()->json(['data' => $this->present($target->fresh())]);
    }

    /**
     * Не `admin.section:roles`, а именно роль. Право раздавать права —
     * единственное, что не должно приходить само из права.
     */
    private function guardOwner(Request $request): void
    {
        if (! AdminAccess::isOwner($request->user())) {
            abort(403, 'Отдельные права выдаёт только Владелец.');
        }
    }

    /**
     * Права выдаются сотруднику, а не любому пользователю.
     *
     * Одна галочка делает список доступных разделов непустым, а вход в
     * админку решается именно этим (AdminAccessController). То есть
     * обычный пользователь получал бы админку, не будучи сотрудником, —
     * и пропадал бы из сводки «Роли и доступ», которая показывает только
     * сотрудников: отозвать выданное стало бы нечем.
     */
    private function find(string $uuid): User
    {
        $user = User::query()->where('uuid', $uuid)->first();
        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        if ($user->role === UserRole::User) {
            abort(422, 'Отдельные права выдаются сотрудникам. Сначала назначьте роль.');
        }

        return $user;
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        // По роли, а не по фактическому доступу: второе шире на выданное,
        // и галочки пропадали бы из списка, едва их поставили.
        $поРоли = AdminAccess::keysForRole($user->role);
        $выдано = AdminAccess::grantsOf($user);

        return [
            'uuid' => $user->uuid,
            'role' => $user->role->value,
            // Что даёт роль — отдельно от того, что выдано: интерфейс
            // показывает первое неснимаемым, а второе — галочкой.
            'by_role' => $поРоли,
            'granted' => $выдано,
            'grantable' => AdminAccess::grantableKeys(),
        ];
    }
}
