<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:200'],
            'body' => ['sometimes', 'string', 'max:10000'],
            'category_id' => ['sometimes', 'integer', 'exists:post_categories,id'],
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:community_subcategories,id'],
            'media_ids' => ['sometimes', 'array', 'max:10'],
            'media_ids.*' => ['uuid', 'exists:media,uuid'],
            'hashtags' => ['sometimes', 'array', 'max:30'],
            'hashtags.*' => ['string', 'max:64'],
        ];
    }
}
