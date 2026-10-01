<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promocode;
use App\Support\PromoCalendar;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Http\Requests\UpsertPromocodeRequest;
use Modules\Admin\Services\AuditService;
use Modules\Admin\Services\PromocodeNotificationService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Billing', weight: 60)]
class AdminPromocodeController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Promocode::query()->with('audienceUsers')->withCount('usages')->latest()->paginate(20);

        /*
         * Состояние и остатки считает сервер, а не браузер. До C4 статус
         * выводился по одному сроку окончания: акция с будущим началом
         * выглядела идущей, а выбравшая все места — активной до последнего
         * дня. Теперь ответ несёт то же, что видит человек.
         */
        $items->getCollection()->transform(function (Promocode $promo): array {
            $использовано = (int) ($promo->usages_count ?? 0);

            return array_merge($promo->withoutRelations()->toArray(), [
                'usages_count' => $использовано,
                'audience' => $promo->audienceUsers->isEmpty() ? 'all' : 'selected',
                'audience_users' => self::кругСписком($promo),
                'state' => PromoCalendar::state($promo, $использовано),
                'seats_left' => PromoCalendar::seatsLeft($promo, $использовано),
                'days_left' => PromoCalendar::daysLeft($promo),
                'days_until_start' => PromoCalendar::daysUntilStart($promo),
            ]);
        });

        return response()->json(['data' => $items]);
    }

    #[Endpoint(title: 'Создать промокод')]
    #[BodyParameter('code', example: 'SPRING25')]
    #[BodyParameter('type', example: 'percent')]
    #[BodyParameter('value', example: 25)]
    #[BodyParameter('max_usages', example: 50)]
    #[BodyParameter('is_active', example: true)]
    public function store(UpsertPromocodeRequest $request, AuditService $audit, PromocodeNotificationService $notify): JsonResponse
    {
        $validated = $request->validated();
        $notifyMode = $validated['notify_mode'] ?? 'none';
        [$круг, $люди] = self::кругИзЗапроса($validated);
        unset($validated['notify_mode'], $validated['notify_title'], $validated['notify_body'], $validated['notify_user_ids']);

        $promocode = Promocode::query()->create($validated);
        self::записатьКруг($promocode, $круг, $люди);
        $audit->log($request->user(), 'admin.promocodes.create', $promocode, null, $promocode->toArray(), $request);

        $sent = 0;
        if ($notifyMode !== 'none') {
            $sent = $notify->sendForPromocode($promocode, $notifyMode, [
                'title' => $request->input('notify_title'),
                'body' => $request->input('notify_body'),
                'user_ids' => $request->input('notify_user_ids', []),
            ]);
        }

        return response()->json(['data' => self::собрать($promocode->fresh()), 'notifications_sent' => $sent], 201);
    }

    #[PathParameter('code', example: SwaggerFixtures::PROMO_CODE)]
    public function show(string $code): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        return response()->json(['data' => self::собрать($promocode)]);
    }

    #[PathParameter('code', example: SwaggerFixtures::PROMO_CODE)]
    #[BodyParameter('value', example: 15)]
    public function update(UpsertPromocodeRequest $request, string $code, AuditService $audit): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        $validated = $request->validated();
        [$круг, $люди] = self::кругИзЗапроса($validated);
        unset($validated['notify_mode'], $validated['notify_title'], $validated['notify_body'], $validated['notify_user_ids']);

        $old = array_merge($promocode->toArray(), ['audience_user_ids' => $promocode->audienceUsers()->pluck('users.id')->all()]);
        // Поля и круг — одной транзакцией: упавшая запись круга оставляла
        // акцию с новым процентом и прежним кругом, и расхождение молчало.
        $promocode = DB::transaction(function () use ($promocode, $validated, $круг, $люди) {
            $promocode->update($validated);
            self::записатьКруг($promocode, $круг, $люди);

            return $promocode->fresh();
        });
        $audit->log($request->user(), 'admin.promocodes.update', $promocode, $old, array_merge(
            $promocode->toArray(),
            ['audience_user_ids' => $promocode->audienceUsers()->pluck('users.id')->all()],
        ), $request);

        return response()->json(['data' => self::собрать($promocode)]);
    }

    /**
     * Круг из запроса: что пришло и кого перечислили.
     *
     * Поля необязательные — старый клиент их не шлёт, и молчание должно
     * означать «не трогать», а не «снять ограничение». Поэтому первый
     * элемент бывает null, и только он отличает «не присылали» от
     * «присылали all».
     *
     * @param  array<string, mixed>  $validated
     * @return array{0: ?string, 1: list<int>}
     */
    private static function кругИзЗапроса(array &$validated): array
    {
        $круг = $validated['audience'] ?? null;
        $люди = array_values(array_unique(array_map('intval', $validated['user_ids'] ?? [])));
        unset($validated['audience'], $validated['user_ids']);

        return [$круг === null ? null : (string) $круг, $люди];
    }

    /** @param  list<int>  $люди */
    private static function записатьКруг(Promocode $promocode, ?string $круг, array $люди): void
    {
        if ($круг === null) {
            return;
        }

        /*
         * Старая привязка к одному человеку снимается вместе с кругом.
         * `promocodes.user_id` — второе, невидимое из админки ограничение:
         * оставить его при круге «всем» значило бы показать «доступен
         * всем» над кодом, который по-прежнему применит только один
         * человек. Миграция перенесла эту привязку в связь, так что
         * ничего не теряется.
         */
        if ($promocode->user_id !== null) {
            $promocode->forceFill(['user_id' => null])->save();
        }

        if ($круг === 'all') {
            $promocode->audienceUsers()->detach();

            return;
        }

        /*
         * Дата включения в круг ставится только тем, кого включают сейчас.
         *
         * `sync` с атрибутами переписывает их и у тех, кто в круге уже
         * состоял: `attachNew` при непустых атрибутах зовёт
         * `updateExistingPivot`. То есть открыть акцию, ничего не менять
         * и сохранить — и у всего круга дата включения становится
         * сегодняшней. Пока правки в админке не было, этот путь проходили
         * раз при создании; с правкой он стал частым. Найдено ревью 01.10.
         */
        $текущие = $promocode->audienceUsers()->pluck('users.id')->all();
        $новые = array_values(array_diff($люди, $текущие));
        $лишние = array_values(array_diff($текущие, $люди));

        if ($лишние !== []) {
            $promocode->audienceUsers()->detach($лишние);
        }
        if ($новые !== []) {
            $promocode->audienceUsers()->attach(array_fill_keys($новые, ['created_at' => now()]));
        }
    }

    /** @return list<array{id: int, name: string, email: string}> */
    private static function кругСписком(Promocode $promocode): array
    {
        return $promocode->audienceUsers
            ->map(fn ($u) => [
                'id' => (int) $u->id,
                'name' => (string) ($u->name ?: $u->email),
                'email' => (string) $u->email,
            ])->values()->all();
    }

    /** @return array<string, mixed> */
    private static function собрать(Promocode $promocode): array
    {
        $promocode->loadMissing('audienceUsers');

        return array_merge($promocode->withoutRelations()->toArray(), [
            'audience' => $promocode->audienceUsers->isEmpty() ? 'all' : 'selected',
            'audience_users' => self::кругСписком($promocode),
        ]);
    }

    #[PathParameter('code', description: 'Код для DELETE-теста (создайте SPRING25)', example: 'SPRING25')]
    public function destroy(string $code, AuditService $audit): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        $promocode->delete();
        $audit->log(request()->user(), 'admin.promocodes.delete', $promocode, $promocode->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Промокод удалён.']]);
    }
}
