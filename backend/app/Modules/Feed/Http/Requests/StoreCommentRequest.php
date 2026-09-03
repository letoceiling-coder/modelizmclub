<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['nullable', 'string', 'max:5000'],
            'parent_uuid' => ['nullable', 'uuid', 'exists:comments,uuid'],
            'media_ids' => ['nullable', 'array', 'max:4'],
            'media_ids.*' => ['uuid', 'exists:media,uuid'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $body = trim((string) $this->input('body', ''));
            $ids = $this->input('media_ids', []);
            if ($body === '' && (! is_array($ids) || $ids === [])) {
                $validator->errors()->add('body', 'Введите текст или прикрепите фото.');
            }
        });
    }
}
