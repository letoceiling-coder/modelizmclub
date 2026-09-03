<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Feed\Support\PostFormRules;

class StoreRepostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['nullable', 'string', 'max:'.PostFormRules::BODY_MAX_LENGTH],
        ];
    }
}
