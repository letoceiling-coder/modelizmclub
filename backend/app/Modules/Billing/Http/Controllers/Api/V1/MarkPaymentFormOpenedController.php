<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Support\PaymentFailure;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * «Человек ушёл на форму банка» — отметка времени.
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ РУЧКА. В воронке есть шаг «дошло до формы», и взять его
 * неоткуда: создание заказа и переход на форму — разные события, между
 * ними человек может закрыть вкладку. Без отметки шаг пришлось бы
 * выдумывать, приравняв его к созданию, — то есть нарисовать стопроцентную
 * доходимость там, где её никто не мерил.
 *
 * Ставится один раз: повторный переход (человек вернулся назад и нажал
 * снова) не должен сдвигать время первого.
 *
 * Чужой платёж отметить нельзя — иначе по чужим uuid можно было бы
 * перебирать, какие из них существуют.
 */
#[Group('Billing', weight: 71)]
class MarkPaymentFormOpenedController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $payment = Payment::query()
            ->where('uuid', $uuid)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($payment->form_opened_at === null && $payment->status === 'pending') {
            $payment->forceFill(['form_opened_at' => now()])->save();
        }

        return response()->json(['data' => [
            'uuid' => $payment->uuid,
            'form_opened_at' => $payment->form_opened_at?->toIso8601String(),
        ]]);
    }
}
