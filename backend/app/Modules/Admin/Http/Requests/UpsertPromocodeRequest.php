<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'type' => ['required', 'string', Rule::in(['percent', 'fixed', 'free'])],
            'scope' => ['nullable', 'string', Rule::in(['listing_placement', 'subscription', 'boost', 'all'])],
            'value' => ['required', 'integer', 'min:0'],
            'max_usages' => ['nullable', 'integer', 'min:1'],
            'max_usages_per_user' => ['nullable', 'integer', 'min:1'],
            'listing_category_id' => ['nullable', 'integer', 'exists:listing_categories,id'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date', 'after:valid_from'],
            'is_active' => ['nullable', 'boolean'],
            'notify_mode' => ['nullable', 'string', Rule::in(['none', 'all', 'selected'])],
            'notify_title' => ['nullable', 'string', 'max:160'],
            'notify_body' => ['nullable', 'string', 'max:1000'],
            'notify_user_ids' => ['nullable', 'array'],
            'notify_user_ids.*' => ['integer', 'exists:users,id'],
        ];
    }
}
