<?php

namespace Modules\User\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePrivacyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'profile_visibility' => ['sometimes', Rule::in(['public', 'registered', 'followers'])],
            'show_email' => ['sometimes', 'boolean'],
            'show_activity' => ['sometimes', 'boolean'],
        ];
    }
}
