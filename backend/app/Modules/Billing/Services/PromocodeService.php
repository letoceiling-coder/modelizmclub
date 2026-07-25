<?php

namespace Modules\Billing\Services;

use App\Models\Promocode;
use App\Models\PromocodeUsage;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PromocodeService
{
    public function findValid(string $code, User $user, string $scope, ?int $listingCategoryId = null): Promocode
    {
        $promocode = Promocode::query()
            ->whereRaw('UPPER(code) = ?', [Str::upper(trim($code))])
            ->first();

        if (! $promocode) {
            throw ValidationException::withMessages([
                'promocode' => ['Промокод не найден.'],
            ]);
        }

        $this->assertValid($promocode, $user, $scope, $listingCategoryId);

        return $promocode;
    }

    public function discountCents(Promocode $promocode, int $amountCents): int
    {
        if ($amountCents <= 0) {
            return 0;
        }

        return match ($promocode->type) {
            'percent' => (int) min($amountCents, round($amountCents * $promocode->value / 100)),
            'fixed' => min($amountCents, max(0, (int) $promocode->value)),
            'free' => $amountCents,
            default => 0,
        };
    }

    public function recordUsage(Promocode $promocode, User $user, ?int $paymentId = null): void
    {
        PromocodeUsage::query()->create([
            'promocode_id' => $promocode->id,
            'user_id' => $user->id,
            'payment_id' => $paymentId,
            'used_at' => now(),
        ]);
    }

    private function assertValid(Promocode $promocode, User $user, string $scope, ?int $listingCategoryId): void
    {
        if (! $promocode->is_active) {
            throw ValidationException::withMessages(['promocode' => ['Промокод неактивен.']]);
        }

        if ($promocode->valid_from && $promocode->valid_from->isFuture()) {
            throw ValidationException::withMessages(['promocode' => ['Промокод ещё не действует.']]);
        }

        if ($promocode->valid_until && $promocode->valid_until->isPast()) {
            throw ValidationException::withMessages(['promocode' => ['Срок действия промокода истёк.']]);
        }

        if ($promocode->user_id && (int) $promocode->user_id !== (int) $user->id) {
            throw ValidationException::withMessages(['promocode' => ['Промокод недоступен для вашего аккаунта.']]);
        }

        if (! in_array($promocode->scope, [$scope, 'all'], true)) {
            throw ValidationException::withMessages(['promocode' => ['Промокод нельзя применить к этой операции.']]);
        }

        if ($promocode->listing_category_id && $listingCategoryId && (int) $promocode->listing_category_id !== $listingCategoryId) {
            throw ValidationException::withMessages(['promocode' => ['Промокод не действует для выбранной категории.']]);
        }

        $totalUsages = $promocode->usages()->count();
        if ($promocode->max_usages !== null && $totalUsages >= $promocode->max_usages) {
            throw ValidationException::withMessages(['promocode' => ['Лимит использований промокода исчерпан.']]);
        }

        $userUsages = $promocode->usages()->where('user_id', $user->id)->count();
        $perUser = $promocode->max_usages_per_user ?? 1;
        if ($userUsages >= $perUser) {
            throw ValidationException::withMessages(['promocode' => ['Вы уже использовали этот промокод.']]);
        }
    }
}
