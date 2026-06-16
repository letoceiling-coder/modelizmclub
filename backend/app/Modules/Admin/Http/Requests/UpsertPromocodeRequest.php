<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpsertPromocodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:64'],
            'type' => ['required', 'string', 'max:32'],
            'value' => ['required', 'integer', 'min:0'],
            'max_usages' => ['nullable', 'integer', 'min:1'],
            'max_usages_per_user' => ['nullable', 'integer', 'min:1'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date', 'after:valid_from'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
