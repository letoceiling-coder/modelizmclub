<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertFooterLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'group' => ['required', 'string', Rule::in(['legal', 'info', 'contacts'])],
            'label' => ['required', 'string', 'max:255'],
            'target_type' => ['required', 'string', Rule::in(['internal', 'external'])],
            'target_value' => ['required', 'string', 'max:2048'],
            'sort' => ['sometimes', 'integer', 'min:0'],
            'is_visible' => ['sometimes', 'boolean'],
        ];
    }
}
