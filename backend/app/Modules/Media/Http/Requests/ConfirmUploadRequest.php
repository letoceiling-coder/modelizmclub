<?php

namespace Modules\Media\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'session_uuid' => ['required', 'uuid', 'exists:upload_sessions,uuid'],
            'media_uuids' => ['required', 'array', 'min:1'],
            'media_uuids.*' => ['uuid', 'exists:media,uuid'],
        ];
    }
}
