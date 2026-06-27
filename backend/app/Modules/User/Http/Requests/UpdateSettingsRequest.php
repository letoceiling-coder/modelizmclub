<?php

namespace Modules\User\Http\Requests;

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
            'preferences' => ['required', 'array', 'min:1'],
            'preferences.*.channel' => ['required', 'string', 'max:32'],
            'preferences.*.type' => ['required', 'string', 'max:64'],
            'preferences.*.enabled' => ['required', 'boolean'],
        ];
    }
}
