<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string', 'max:120'],
            // Empty object/array is valid (e.g. clearing icon_overrides).
            'settings.*.value' => ['present'],
            'settings.*.group' => ['nullable', 'string', 'max:64'],
        ];
    }
}
