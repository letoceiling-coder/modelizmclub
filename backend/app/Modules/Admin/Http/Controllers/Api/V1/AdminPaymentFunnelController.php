<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Support\PaymentFailure;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Воронка оплат: начато → дошло до формы → оплачено → отказано и почему.
 *
 * ЗАГЛУШКА НЕ СЧИТАЕТСЯ. Тестовый контур ставит «оплачено» без банка: на
 * 30.09 в боевой базе 39 таких «оплат» из 46. Смешав их с настоящими, мы
 * получили бы воронку, где всё прекрасно. Поэтому `provider = stub`
 * исключён везде, и об этом сказано в ответе — иначе первый же вопрос
 * будет «а почему числа не сходятся со списком платежей».
 *
 * БРОШЕННАЯ ФОРМА — СВОЙ ШАГ. Она не отказ: банк такого платежа не видел.
 * Сложив их вместе, воронка утверждала бы, что банк отклоняет почти всё.
 *
 * ПРИЧИНЫ — ПО НАШЕМУ КОДУ, А НЕ ПО ТЕКСТУ. Текст провайдера хранится
 * рядом и виден в строке платежа; группировать по нему нельзя — он
 * свободный и у разных провайдеров разный.
 */
#[Group('Admin — Billing', weight: 73)]
class AdminPaymentFunnelController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        [$от, $до] = $this->период($request);

        $база = Payment::query()
            ->where('provider', '!=', Payment::STUB_PROVIDER)
            ->when($от, fn ($q) => $q->where('created_at', '>=', $от))
            ->when($до, fn ($q) => $q->where('created_at', '<=', $до));

        $начато = (clone $база)->count();
        $доФормы = (clone $база)->whereNotNull('form_opened_at')->count();
        $оплачено = (clone $база)->where('status', 'paid')->count();
        $отказано = (clone $база)->where('status', 'failed')->count();
        $брошено = (clone $база)->where('status', 'abandoned')->count();
        $вРаботе = (clone $база)->where('status', 'pending')->count();

        $причины = (clone $база)
            ->where('status', 'failed')
            ->select('failure_code', DB::raw('count(*) as сколько'))
            ->groupBy('failure_code')
            ->orderByDesc('сколько')
            ->get()
            ->map(fn ($r) => [
                'code' => $r->failure_code,
                'label' => PaymentFailure::label($r->failure_code),
                'count' => (int) $r->сколько,
            ])
            ->all();

        $шаги = (clone $база)
            ->whereIn('status', ['failed', 'abandoned'])
            ->select('failure_stage', DB::raw('count(*) as сколько'))
            ->groupBy('failure_stage')
            ->get()
            ->map(fn ($r) => [
                'stage' => $r->failure_stage,
                'label' => PaymentFailure::stageLabels()[$r->failure_stage] ?? (string) $r->failure_stage,
                'count' => (int) $r->сколько,
            ])
            ->all();

        /*
         * Сколько прошло от создания до отказа — по `failed_at`, а не по
         * `updated_at`. Разница не теоретическая: до 30.09 `updated_at` у
         * пяти августовских платежей стоял 08.09, потому что один прогон
         * сверки закрыл их разом три недели спустя.
         */
        $медиана = (clone $база)
            ->whereNotNull('failed_at')
            ->selectRaw('percentile_cont(0.5) within group (order by extract(epoch from (failed_at - created_at))) as сек')
            ->value('сек');

        return response()->json(['data' => [
            'from' => $от?->toIso8601String(),
            'to' => $до?->toIso8601String(),
            'excludes_stub' => true,
            'steps' => [
                ['key' => 'started', 'label' => 'Начато', 'count' => $начато],
                ['key' => 'form', 'label' => 'Дошло до формы', 'count' => $доФормы],
                ['key' => 'paid', 'label' => 'Оплачено', 'count' => $оплачено],
            ],
            'outcomes' => [
                ['key' => 'paid', 'label' => 'Оплачено', 'count' => $оплачено],
                ['key' => 'failed', 'label' => 'Отказано', 'count' => $отказано],
                ['key' => 'abandoned', 'label' => 'Форма брошена', 'count' => $брошено],
                ['key' => 'pending', 'label' => 'В работе', 'count' => $вРаботе],
            ],
            'reasons' => $причины,
            'stages' => $шаги,
            'median_seconds_to_failure' => $медиана === null ? null : (int) round((float) $медиана),
        ]]);
    }

    /** @return array{0: ?Carbon, 1: ?Carbon} */
    private function период(Request $request): array
    {
        $разбор = static function (?string $v, bool $конец): ?Carbon {
            if (! is_string($v) || trim($v) === '') {
                return null;
            }
            try {
                $d = Carbon::parse($v);
            } catch (\Throwable) {
                return null;
            }

            // Дата без времени значит целые сутки: «по 30.09» — включая его.
            return $конец && $d->format('H:i:s') === '00:00:00' ? $d->endOfDay() : $d;
        };

        return [$разбор($request->query('from'), false), $разбор($request->query('to'), true)];
    }
}
