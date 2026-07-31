<?php

namespace Modules\Feed\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SchedulePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'scheduled_at' => ['required_without:scheduled_at_local', 'date', 'after:now'],
            'scheduled_at_local' => ['required_without:scheduled_at', 'date_format:Y-m-d H:i:s'],
            'timezone' => ['required_with:scheduled_at_local', 'string', Rule::in(timezone_identifiers_list())],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'scheduled_at.required_without' => 'Укажите дату и время публикации.',
            'scheduled_at.after' => 'Время публикации должно быть в будущем.',
            'scheduled_at_local.required_without' => 'Укажите дату и время публикации.',
            'scheduled_at_local.date_format' => 'Некорректная дата и время.',
            'timezone.required_with' => 'Укажите часовой пояс.',
            'timezone.in' => 'Некорректный часовой пояс.',
        ];
    }
}
