<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'category_id' => ['required', 'integer', 'exists:post_categories,id'],
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:community_subcategories,id'],
            'media_ids' => ['array', 'max:10'],
            'media_ids.*' => ['uuid', 'exists:media,uuid'],
            'hashtags' => ['array', 'max:30'],
            'hashtags.*' => ['string', 'max:64'],
        ];
    }
}
