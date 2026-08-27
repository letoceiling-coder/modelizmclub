<?php

namespace Modules\Admin\Http\Requests;

use App\Enums\RuleSectionType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertRulePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'slug' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-z0-9-]+$/',
                Rule::unique('rule_pages', 'slug')->ignore($id),
            ],
            'title' => ['required', 'string', 'max:255'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:320'],
            'summary' => ['nullable', 'string', 'max:500'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'sections' => ['nullable', 'array'],
            'sections.*.type' => ['required', Rule::enum(RuleSectionType::class)],
            'sections.*.title' => ['nullable', 'string', 'max:255'],
            'sections.*.content' => ['nullable', 'string'],
            'sections.*.position' => ['nullable', 'integer', 'min:0'],
            'sections.*.is_visible' => ['nullable', 'boolean'],
        ];
    }
}
