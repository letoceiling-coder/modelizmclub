<?php

namespace Modules\Account\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Auth\Services\PhoneVerificationService;

class VerifyPhoneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $maxLen = max(PhoneVerificationService::codeLength(), PhoneVerificationService::otpCodeLength());

        return [
            'phone' => ['required', 'string', 'max:20'],
            'session_id' => ['nullable', 'uuid'],
            'code' => ['required', 'string', 'regex:/^\d{4,'.$maxLen.'}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.required' => 'Укажите номер телефона.',
            'code.required' => 'Введите код из SMS.',
            'code.regex' => 'Код должен состоять из цифр.',
        ];
    }
}
