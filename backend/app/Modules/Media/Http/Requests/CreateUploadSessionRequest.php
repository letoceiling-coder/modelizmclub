<?php

namespace Modules\Media\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Media\Services\MediaUploadService;

class CreateUploadSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'purpose' => ['required', 'string', Rule::in(MediaUploadService::purposes())],
            'files' => ['required', 'array', 'min:1'],
            'files.*.name' => ['required', 'string', 'max:255'],
            'files.*.size' => ['required', 'integer', 'min:1'],
            'files.*.mime' => ['required', 'string', 'max:127'],
        ];
    }
}
