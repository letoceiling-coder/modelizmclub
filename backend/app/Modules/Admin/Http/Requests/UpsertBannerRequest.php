<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $placements = ['events', 'feed', 'feed_top', 'feed_inline', 'sidebar'];

        return [
            'placement' => [$this->isMethod('post') ? 'required' : 'sometimes', 'string', 'max:32', Rule::in($placements)],
            'title' => [$this->isMethod('post') ? 'required' : 'sometimes', 'string', 'max:200'],
            'image_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'image_media_uuid' => ['nullable', 'uuid', 'exists:media,uuid'],
            'link_url' => ['nullable', 'string', 'max:500'],
            'text' => ['nullable', 'string', 'max:2000'],
            'cta_text' => ['nullable', 'string', 'max:100'],
            'kind' => ['nullable', 'string', 'max:16', Rule::in(['event', 'news', 'promo'])],
            'until_label' => ['nullable', 'string', 'max:64'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['nullable', 'boolean'],
            'force_visible' => ['nullable', 'boolean'],
            'is_pinned' => ['nullable', 'boolean'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
