<?php

namespace Modules\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ConsentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'document_version' => ['required', 'string', 'max:32'],
        ];
    }

    public function messages(): array
    {
        return [
            'document_version.required' => 'Укажите версию документа согласия.',
        ];
    }
}
