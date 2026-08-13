<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminUpdateVideoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['sometimes', 'string', 'uuid'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:64'],
            'poster_media_id' => ['nullable', 'string', 'uuid'],
            'video_media_id' => ['sometimes', 'string', 'uuid'],
            'is_featured' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['processing', 'published', 'rejected', 'scheduled'])],
        ];
    }
}
