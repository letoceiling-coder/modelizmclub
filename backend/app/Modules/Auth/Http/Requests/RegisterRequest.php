<?php

namespace Modules\Auth\Http\Requests;

use App\Enums\RegistrationTrack;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }

        if ($this->has('display_name')) {
            $name = trim(preg_replace('/\s+/u', ' ', (string) $this->input('display_name')) ?? '');
            $this->merge(['display_name' => $name !== '' ? $name : null]);
        }
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email:rfc', 'max:255'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'registration_track' => ['required', Rule::enum(RegistrationTrack::class)],
            'display_name' => [
                'required',
                'string',
                'min:2',
                'max:120',
                'regex:/^[A-Za-zА-Яа-яЁё\s\'\x{2019}-]+$/u',
            ],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
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
            'display_name.required' => 'Укажите имя и фамилию.',
            'display_name.min' => 'Имя должно быть не короче 2 символов.',
            'display_name.max' => 'Имя не должно быть длиннее 120 символов.',
            'display_name.regex' => 'Имя может содержать только буквы, пробел, дефис и апостроф.',
        ];
    }
}
