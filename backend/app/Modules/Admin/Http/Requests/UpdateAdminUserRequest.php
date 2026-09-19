<?php

namespace Modules\Admin\Http\Requests;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Rules\SafeEmail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateAdminUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = User::query()->where('uuid', $this->route('uuid'))->value('id');

        return [
            'email' => ['sometimes', 'email', new SafeEmail, 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => ['sometimes', Password::min(8)],
            'name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'role' => ['sometimes', Rule::enum(UserRole::class)],
            'status' => ['sometimes', Rule::enum(UserStatus::class)],
            // Льготы на человека (RolePrivileges) — правит только Владелец.
            'subscription_exempt' => ['sometimes', 'boolean'],
            'free_listings_quota' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'free_listings_unlimited' => ['sometimes', 'boolean'],
            'free_listings_used' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ];
    }
}
