<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpsertBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'placement' => ['required', 'string', 'max:32'],
            'title' => ['required', 'string', 'max:200'],
            'image_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'link_url' => ['nullable', 'url', 'max:500'],
            'text' => ['nullable', 'string', 'max:2000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
