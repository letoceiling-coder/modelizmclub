<?php

namespace Modules\Listing\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AiSuggestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:200', 'required_without_all:description,hints'],
            'description' => ['nullable', 'string', 'max:10000'],
            'hints' => ['nullable', 'array', 'max:20'],
            'hints.*' => ['string', 'max:64'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required_without_all' => 'Укажите название, описание или подсказки для распознавания.',
        ];
    }
}
