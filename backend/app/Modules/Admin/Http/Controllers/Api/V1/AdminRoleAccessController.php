<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\AdminAccess;
use App\Support\RoleAccessOverrides;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Services\AuditService;

/**
 * Что открывает роль — правка из админки.
 *
 * Раздел показывал карту галочками и ничего не позволял: поменять состав
 * можно было только правкой константы `AdminAccess::SECTIONS` и выкаткой.
 *
 * ПРИНИМАЕТСЯ ПОЛНАЯ КАРТА, А ХРАНЯТСЯ ОТЛИЧИЯ. Экран присылает то, что на
 * нём стоит сейчас, целиком; `RoleAccessOverrides::store` сворачивает это к
 * отличиям от зашитой карты. Если бы хранилась присланная карта целиком,
 * первая же правка заморозила бы все сорок ключей, и следующая правка
 * умолчаний в коде перестала бы что-либо менять.
 *
 * РОЛИ ЛЮДЕЙ НЕ ТРОГАЮТСЯ. Меняется карта «роль → разделы», колонка
 * `users.role` не пишется вовсе. Поэтому «права модератора изменил — роли
 * слетели» невозможно по построению, и это закреплено тестом.
 *
 * ПРИМЕНЯЕТСЯ СРАЗУ. Настройка читается на каждом запросе (в пределах одного
 * запроса — из памятки), кеша между запросами нет. Следующий же запрос
 * любого модератора идёт по новой карте.
 *
 * В ЖУРНАЛ ПИШЕТСЯ, ЧТО ИМЕННО. Не «карта изменена», а список клеток:
 * роль, ключ, было, стало. Разбор «кто и когда открыл модератору обращения»
 * иначе пришлось бы делать сверкой двух снимков карты.
 */
#[Group('Admin — Roles', weight: 35)]
class AdminRoleAccessController extends Controller
{
    #[Endpoint(
        title: 'Что открывает роль: сохранить',
        description: 'Принимает полную карту роль → ключ → доступен ли. Только Владелец.',
    )]
    #[BodyParameter('access', description: 'Карта: { "moderator": { "events": true } }')]
    public function __invoke(Request $request, AuditService $audit): JsonResponse
    {
        $this->guardOwner($request);

        $data = $request->validate([
            'access' => ['required', 'array'],
            'access.*' => ['array'],
            'access.*.*' => ['boolean'],
        ]);

        $до = RoleAccessOverrides::effective();
        $присланное = $this->нормализовать($data['access'], $до);

        $изменения = $this->разница($до, $присланное);

        if ($изменения === []) {
            return response()->json(['data' => [
                'access' => $до,
                'changed' => [],
            ]]);
        }

        RoleAccessOverrides::store($присланное);
        $после = RoleAccessOverrides::effective();

        /*
         * Проверка после записи, а не до: запертую клетку `store` не пишет
         * вовсе, и убедиться надо в том, что получилось, а не в том, что
         * просили. Если бы Владелец всё же остался без `roles`, дверь к
         * правке карты закрылась бы навсегда — вернуть её было бы нечем,
         * кроме правки базы руками.
         */
        foreach (RoleAccessOverrides::LOCKED as $роль => $ключи) {
            foreach ($ключи as $ключ) {
                if (($после[$роль][$ключ] ?? false) !== true) {
                    throw ValidationException::withMessages([
                        'access' => ["Доступ «{$ключ}» у роли «{$роль}» снять нельзя: это единственная дверь к правке прав."],
                    ]);
                }
            }
        }

        $audit->log(
            $request->user(),
            'admin.roles.access',
            null,
            ['changed' => array_map(fn (array $c) => $c['from'], $изменения)],
            ['changed' => $изменения],
            $request,
        );

        return response()->json(['data' => [
            'access' => $после,
            'changed' => $изменения,
        ]]);
    }

    /**
     * Не `admin.section:roles`, а именно роль.
     *
     * Докблок класса обещал «Только Владелец», а проверки не было ни в каком
     * виде: единственным стражем стоял `admin.section:roles`. А ключ `roles`
     * переопределяется той же картой, которую эта ручка пишет, и настройка
     * спрашивается раньше ранга (`AdminAccess::allows`). `LOCKED` при этом
     * запрещает только **отобрать** `roles` у Владельца, но не **выдать** его
     * модератору или администратору направления.
     *
     * То есть одна галочка в матрице ролей открывала роли право править саму
     * матрицу, а дальше — `monetization`, `users.manage`, `settings`, то есть
     * деньги и права. Шаг требовал ошибки Владельца, но цена несимметрична:
     * по разбору 24.09 вернуть себе владельца может только владелец.
     *
     * Та же защита у соседа: `AdminUserPermissionsController::guardOwner`.
     */
    private function guardOwner(Request $request): void
    {
        if (! AdminAccess::isOwner($request->user())) {
            abort(403, 'Карту прав ролей правит только Владелец.');
        }
    }

    /**
     * Дополнить присланное тем, чего в нём нет.
     *
     * Экран мог не знать про ключ, добавленный в код позже его загрузки.
     * Считать отсутствующую клетку закрытой значило бы молча снять доступ по
     * ключу, которого человек не видел и не трогал.
     *
     * @param  array<mixed>  $присланное
     * @param  array<string, array<string, bool>>  $текущее
     * @return array<string, array<string, bool>>
     */
    private function нормализовать(array $присланное, array $текущее): array
    {
        $карта = $текущее;

        foreach ($присланное as $роль => $ключи) {
            if (! isset($карта[$роль]) || ! is_array($ключи)) {
                continue;
            }
            foreach ($ключи as $ключ => $значение) {
                if (array_key_exists($ключ, $карта[$роль]) && is_bool($значение)) {
                    $карта[$роль][$ключ] = $значение;
                }
            }
        }

        return $карта;
    }

    /**
     * Что именно поменялось — клетками, для журнала и для ответа экрану.
     *
     * @param  array<string, array<string, bool>>  $до
     * @param  array<string, array<string, bool>>  $после
     * @return list<array{role: string, key: string, from: bool, to: bool, section: bool}>
     */
    private function разница(array $до, array $после): array
    {
        $разделы = AdminAccess::sectionLevels();
        $изменения = [];

        foreach ($после as $роль => $ключи) {
            foreach ($ключи as $ключ => $стало) {
                $было = $до[$роль][$ключ] ?? null;
                if ($было === $стало) {
                    continue;
                }
                $изменения[] = [
                    'role' => $роль,
                    'key' => $ключ,
                    'from' => (bool) $было,
                    'to' => (bool) $стало,
                    // Раздел меню или служебный ключ: в журнале это разное.
                    'section' => array_key_exists($ключ, $разделы),
                ];
            }
        }

        return $изменения;
    }
}
