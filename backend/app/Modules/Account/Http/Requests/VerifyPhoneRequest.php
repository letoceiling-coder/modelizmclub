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

    /**
     * Длина — из настройки (решение З1).
     *
     * Здесь стояло `size:6` с текстом «Код должен состоять из 6 цифр» —
     * четвёртая независимая запись той же шестёрки, и самая коварная: она
     * срабатывает раньше сервиса, то есть смена настройки давала отказ
     * проверки формы с прежним числом в тексте.
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'max:20'],
            'code' => ['required', 'string', 'size:'.PhoneVerificationService::codeLength()],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.required' => 'Укажите номер телефона.',
            'code.required' => 'Введите код из SMS.',
            'code.size' => 'Код состоит из '.PhoneVerificationService::codeLength().' цифр.',
        ];
    }
}
