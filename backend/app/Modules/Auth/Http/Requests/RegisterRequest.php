<?php

namespace Modules\Auth\Http\Requests;

use App\Enums\RegistrationTrack;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'registration_track' => ['required', Rule::enum(RegistrationTrack::class)],
            'display_name' => ['nullable', 'string', 'max:120'],
            'referral_code' => ['nullable', 'string', 'max:40'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'Укажите email.',
            'email.email' => 'Некорректный email.',
            'password.required' => 'Укажите пароль.',
            'password.confirmed' => 'Пароли не совпадают.',
            'registration_track.required' => 'Выберите тип регистрации.',
        ];
    }
}
