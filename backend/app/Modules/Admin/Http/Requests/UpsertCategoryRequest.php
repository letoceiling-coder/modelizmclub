<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpsertCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'slug.regex' => 'Slug — латиница, цифры и дефис: например «sbornye-modeli».',
        ];
    }

    public function rules(): array
    {
        return [
            'parent_id' => ['nullable', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:120'],
            // Slug уходит в адреса и в выгрузки. Поле подписано «латиницей», но
            // до 08.09 сюда проходило что угодно: в проде оказалась категория
            // со slug «QA категория 08.09» — кириллица и пробелы. Правило то же,
            // что у FAQ-категорий, чтобы не заводить второе.
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'icon' => ['nullable', 'string', 'max:64'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'listing_price_cents' => ['nullable', 'integer', 'min:0'],
            'subscriber_listing_price_cents' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
