<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\CardBindingService;

class CompleteCardBindingController extends Controller
{
    public function __invoke(Request $request, CardBindingService $binding): RedirectResponse
    {
        $token = (string) $request->query('token', '');
        $frontend = rtrim((string) config('billing.frontend_url'), '/');

        if ($token === '' || ! $binding->completeStub($token)) {
            return redirect()->away($frontend.'/settings/payment-methods?card=failed');
        }

        return redirect()->away($frontend.'/settings/payment-methods?card=added');
    }
}
