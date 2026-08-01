<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Feed\Support\PostFormRules;

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
            'title' => ['sometimes', 'string', 'max:'.PostFormRules::TITLE_MAX_LENGTH],
            'body' => ['sometimes', 'string', 'max:'.PostFormRules::BODY_MAX_LENGTH],
            'category_id' => ['sometimes', 'integer', 'exists:post_categories,id'],
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:community_subcategories,id'],
            'media_ids' => ['sometimes', 'array', 'max:10'],
            'media_ids.*' => ['uuid', 'exists:media,uuid'],
            'hashtags' => ['sometimes', 'array', 'max:30'],
            'hashtags.*' => ['string', 'max:64'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return PostFormRules::messages();
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return PostFormRules::attributes();
    }
}
