<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\EmailAccountService;

class ChangeEmailController extends Controller
{
    public function __invoke(Request $request, EmailAccountService $emails): JsonResponse
    {
        $data = $request->validate(['new_email' => ['required', 'email', 'max:255']]);
        $emails->requestChange($request->user(), $data['new_email']);

        return response()->json(['pending' => true], 202);
    }
}
