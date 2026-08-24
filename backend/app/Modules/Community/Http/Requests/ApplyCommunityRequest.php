<?php

namespace Modules\Community\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApplyCommunityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'proposed_name' => ['required', 'string', 'min:3', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category_id' => ['nullable', 'integer', Rule::exists('community_categories', 'id')->where('is_active', true)],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
            'post_category_ids' => ['nullable', 'array', 'max:12'],
            'post_category_ids.*' => ['integer', Rule::exists('post_categories', 'id')->where('is_active', true)],
            'custom_category' => ['nullable', 'string', 'max:120'],
            'rules' => ['nullable', 'string', 'max:8000'],
            'access_type' => ['nullable', 'in:open,request'],
            'contacts' => ['nullable', 'array'],
            'contacts.telegram' => ['nullable', 'string', 'max:255'],
            'contacts.website' => ['nullable', 'string', 'max:255'],
            'contacts.phone' => ['nullable', 'string', 'max:40'],
            'avatar_media_uuid' => ['nullable', 'uuid', 'exists:media,uuid'],
            'cover_media_uuid' => ['nullable', 'uuid', 'exists:media,uuid'],
        ];
    }
}
