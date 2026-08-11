<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowFeeCalculator;
use Modules\Billing\Services\EscrowFeeSettings;

#[Group('Admin — Escrow', weight: 26)]
class AdminEscrowFeePreviewController extends Controller
{
    public function __invoke(Request $request, EscrowFeeCalculator $calculator, EscrowFeeSettings $settings): JsonResponse
    {
        $data = $request->validate([
            'item_cents' => ['required', 'integer', 'min:0'],
            'delivery_cents' => ['nullable', 'integer', 'min:0'],
        ]);

        $quote = $calculator->quote(
            (int) $data['item_cents'],
            (int) ($data['delivery_cents'] ?? 0),
        );

        return response()->json([
            'data' => array_merge($quote, [
                'settings' => $settings->snapshot(),
            ]),
        ]);
    }
}
