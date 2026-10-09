<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Modules\Media\Services\VoiceTranscriber;

class FeatureFlagsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'communities_enabled' => FeatureFlags::enabled('feature.communities_enabled'),
                'reviews_enabled' => FeatureFlags::enabled('feature.reviews_enabled', true),
                'market_enabled' => FeatureFlags::enabled('feature.market_enabled'),
                'escrow_enabled' => FeatureFlags::enabled('feature.escrow_enabled'),
                'listing_payment_enabled' => FeatureFlags::enabled('feature.listing_payment_enabled'),
                'voice_transcription_enabled' => VoiceTranscriber::available(),
                /*
                 * Звонки настроены — находка B-09 и решение D10 от 05.10.
                 *
                 * Решение: «Групповой звонок: работает на стенде — вторичное
                 * действие с выбором участников; не работает — активную
                 * кнопку убрать и записать блокер». Аудит нашёл кнопку на
                 * месте при пустых `livekit.*`, и выяснить, настроен ли
                 * контур на проде, мог только владелец.
                 *
                 * Признак снимает этот вопрос: кнопка показывается там, где
                 * звонок действительно может состояться. Это настоящая
                 * проверка настройки, а не галочка в админке, — как у
                 * расшифровки голосовых строкой выше. Те же три значения
                 * проверяет `LiveKitController` перед выдачей токена;
                 * разойтись они не должны.
                 */
                'calls_enabled' => (string) config('livekit.url') !== ''
                    && (string) config('livekit.api_key') !== ''
                    && (string) config('livekit.api_secret') !== '',
            ],
        ]);
    }
}
