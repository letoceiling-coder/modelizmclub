<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWalletController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Wallet::query()->with('user')->orderByDesc('balance_kopecks');

        if ($search = $request->query('search')) {
            $query->whereHas('user', function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate(min(100, max(1, (int) $request->query('per_page', 25))));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Wallet $w) => [
                'user' => ['uuid' => $w->user?->uuid, 'name' => $w->user?->name, 'email' => $w->user?->email],
                'balance_kopecks' => (int) $w->balance_kopecks,
                'held_kopecks' => (int) $w->held_kopecks,
            ])->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        $user = User::query()->where('uuid', $uuid)->firstOrFail();
        $wallet = Wallet::query()->firstOrCreate(['user_id' => $user->id], ['balance_kopecks' => 0, 'held_kopecks' => 0]);

        $transactions = WalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (WalletTransaction $tx) => [
                'id' => (string) $tx->id,
                'type' => $tx->type->value,
                'amount_kopecks' => (int) $tx->amount_kopecks,
                'balance_after' => (int) $tx->balance_after,
                'description' => $tx->description,
                'date' => $tx->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'data' => [
                'user' => ['uuid' => $user->uuid, 'name' => $user->name],
                'balance_kopecks' => (int) $wallet->balance_kopecks,
                'held_kopecks' => (int) $wallet->held_kopecks,
                'transactions' => $transactions,
            ],
        ]);
    }
}
