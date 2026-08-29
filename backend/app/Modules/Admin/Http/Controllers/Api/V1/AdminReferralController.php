<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Models\User;
use App\Support\ReferralProgramConfig;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Admin — Billing', weight: 75)]
class AdminReferralController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, $request->integer('per_page', 30)));

        $paginator = User::query()
            ->whereNotNull('referred_by')
            ->with(['profile', 'referrer.profile'])
            ->latest('id')
            ->paginate($perPage);

        $inviteeIds = collect($paginator->items())->pluck('id')->all();
        $statusByInvitee = Referral::query()
            ->whereIn('invitee_id', $inviteeIds)
            ->get()
            ->keyBy('invitee_id');

        return response()->json([
            'data' => collect($paginator->items())->map(function (User $u) use ($statusByInvitee) {
                $row = $statusByInvitee->get($u->id);

                return [
                    'invitee' => [
                        'uuid' => $u->uuid,
                        'display_name' => $u->profile?->display_name ?? $u->name,
                        'slug' => $u->profile?->slug,
                        'email' => $u->displayEmail(),
                    ],
                    'inviter' => $u->referrer ? [
                        'uuid' => $u->referrer->uuid,
                        'display_name' => $u->referrer->profile?->display_name ?? $u->referrer->name,
                        'slug' => $u->referrer->profile?->slug,
                        'referral_code' => $u->referrer->referral_code,
                    ] : null,
                    'joined_at' => $u->created_at?->toIso8601String(),
                    'phone_verified' => $u->phone_verified_at !== null,
                    'status' => $row?->status instanceof \App\Enums\ReferralStatus
                        ? $row->status->value
                        : ($u->phone_verified_at ? 'completed' : 'pending'),
                ];
            })->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
            'settings' => ReferralProgramConfig::get(),
        ]);
    }
}
