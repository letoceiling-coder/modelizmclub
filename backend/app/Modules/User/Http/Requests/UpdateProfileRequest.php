<?php

namespace Modules\User\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'display_name' => ['sometimes', 'string', 'min:2', 'max:64'],
            'slug' => ['sometimes', 'string', 'min:2', 'max:64', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'city_id' => ['sometimes', 'nullable', 'integer', Rule::exists('cities', 'id')],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'vk_url' => ['sometimes', 'nullable', 'string', 'max:512', 'url'],
            'telegram_url' => ['sometimes', 'nullable', 'string', 'max:512', 'url'],
            'website_url' => ['sometimes', 'nullable', 'string', 'max:512', 'url'],
            'avatar_media_id' => ['sometimes', 'nullable'],
            'avatar_media_uuid' => ['sometimes', 'nullable', 'string', Rule::exists('media', 'uuid')],
            'cover_media_id' => ['sometimes', 'nullable'],
            'cover_media_uuid' => ['sometimes', 'nullable', 'string', Rule::exists('media', 'uuid')],
        ];
    }
}
