<?php

namespace Modules\Report\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Report\Services\ReportService;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // Список берётся у сервиса, а не повторяется здесь второй раз:
            // 'community' уже был в ReportService::TYPES, но не был указан в
            // правиле — жалоба на сообщество отклонялась валидацией, не дойдя
            // до обработчика. Один источник вместо двух расходящихся.
            'type' => ['required', 'string', Rule::in(array_keys(ReportService::reportableTypes()))],
            'target_id' => ['required', 'uuid'],
            'reason' => ['required', 'string', Rule::in(ReportService::REASONS)],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
