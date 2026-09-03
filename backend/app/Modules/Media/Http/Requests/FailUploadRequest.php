<?php

namespace Modules\Media\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FailUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'media_uuids' => ['required', 'array', 'min:1'],
            'media_uuids.*' => ['uuid', 'exists:media,uuid'],
        ];
    }
}
