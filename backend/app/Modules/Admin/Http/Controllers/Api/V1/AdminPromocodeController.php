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
use Modules\Admin\Http\Requests\UpsertPromocodeRequest;
use Modules\Admin\Services\AuditService;
use Modules\Admin\Services\PromocodeNotificationService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Billing', weight: 60)]
class AdminPromocodeController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Promocode::query()->withCount('usages')->latest()->paginate(20);

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
        unset($validated['notify_mode'], $validated['notify_title'], $validated['notify_body'], $validated['notify_user_ids']);

        $promocode = Promocode::query()->create($validated);
        $audit->log($request->user(), 'admin.promocodes.create', $promocode, null, $promocode->toArray(), $request);

        $sent = 0;
        if ($notifyMode !== 'none') {
            $sent = $notify->sendForPromocode($promocode, $notifyMode, [
                'title' => $request->input('notify_title'),
                'body' => $request->input('notify_body'),
                'user_ids' => $request->input('notify_user_ids', []),
            ]);
        }

        return response()->json(['data' => $promocode, 'notifications_sent' => $sent], 201);
    }

    #[PathParameter('code', example: SwaggerFixtures::PROMO_CODE)]
    public function show(string $code): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        return response()->json(['data' => $promocode]);
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
        unset($validated['notify_mode'], $validated['notify_title'], $validated['notify_body'], $validated['notify_user_ids']);

        $old = $promocode->toArray();
        $promocode->update($validated);
        $audit->log($request->user(), 'admin.promocodes.update', $promocode, $old, $promocode->fresh()->toArray(), $request);

        return response()->json(['data' => $promocode->fresh()]);
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
