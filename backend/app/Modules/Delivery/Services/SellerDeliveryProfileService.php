<?php

namespace Modules\Delivery\Services;

use App\Enums\DeliveryCarrier;
use App\Enums\DeliveryPointType;
use App\Models\SellerDeliveryProfile;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class SellerDeliveryProfileService
{
    public function listForUser(User $user): Collection
    {
        return SellerDeliveryProfile::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('provider')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $user, array $data): SellerDeliveryProfile
    {
        $provider = DeliveryCarrier::from($data['provider']);
        $pointType = DeliveryPointType::from($data['point_type']);

        DeliveryCarrierRegistry::class; // ensure provider exists

        if ($data['is_default'] ?? false) {
            $this->clearDefault($user, $provider);
        }

        return SellerDeliveryProfile::query()->create([
            'user_id' => $user->id,
            'provider' => $provider,
            'point_type' => $pointType,
            'external_point_id' => $data['external_point_id'],
            'label' => $data['label'] ?? null,
            'address' => $data['address'] ?? null,
            'city_id' => $data['city_id'] ?? null,
            'is_default' => (bool) ($data['is_default'] ?? false),
            'meta' => $data['meta'] ?? null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(SellerDeliveryProfile $profile, array $data): SellerDeliveryProfile
    {
        if (($data['is_default'] ?? false) === true) {
            $this->clearDefault($profile->user, $profile->provider);
        }

        $profile->fill([
            'label' => $data['label'] ?? $profile->label,
            'address' => $data['address'] ?? $profile->address,
            'city_id' => $data['city_id'] ?? $profile->city_id,
            'is_default' => $data['is_default'] ?? $profile->is_default,
            'meta' => $data['meta'] ?? $profile->meta,
        ]);
        $profile->save();

        return $profile->fresh();
    }

    public function deactivate(SellerDeliveryProfile $profile): void
    {
        $profile->update(['is_active' => false, 'is_default' => false]);
    }

    public function defaultFor(User $user, DeliveryCarrier $provider): ?SellerDeliveryProfile
    {
        return SellerDeliveryProfile::query()
            ->where('user_id', $user->id)
            ->where('provider', $provider)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->first();
    }

    public function assertOwnedBy(SellerDeliveryProfile $profile, User $user): void
    {
        if ($profile->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'profile' => ['Профиль доставки не найден.'],
            ]);
        }
    }

    private function clearDefault(User $user, DeliveryCarrier $provider): void
    {
        SellerDeliveryProfile::query()
            ->where('user_id', $user->id)
            ->where('provider', $provider)
            ->update(['is_default' => false]);
    }
}
