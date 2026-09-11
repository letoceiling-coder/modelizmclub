<?php

namespace Modules\Auth\Http\Requests;

use App\Rules\SafeEmail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LoginRequest extends FormRequest
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
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', new SafeEmail, 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'Укажите email.',
            'password.required' => 'Укажите пароль.',
        ];
    }
}
