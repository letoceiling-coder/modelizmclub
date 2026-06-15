<?php

namespace Modules\User\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncInterestsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_ids' => ['present', 'array', 'max:50'],
            'category_ids.*' => ['integer', 'distinct'],
        ];
    }
}
