<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Feed\Support\PostFormRules;

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
            'title' => ['required', 'string', 'max:'.PostFormRules::TITLE_MAX_LENGTH],
            'body' => ['required', 'string', 'max:'.PostFormRules::BODY_MAX_LENGTH],
            // Направление — необязательное (как во ВКонтакте): пост можно
            // опубликовать без категории. Колонка posts.category_id уже
            // nullable, так что миграция не нужна.
            'category_id' => ['nullable', 'integer', 'exists:post_categories,id'],
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:community_subcategories,id'],
            'media_ids' => ['array', 'max:10'],
            'media_ids.*' => ['uuid', 'exists:media,uuid'],
            'hashtags' => ['array', 'max:30'],
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
