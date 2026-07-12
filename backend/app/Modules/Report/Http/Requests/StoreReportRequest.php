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
            'type' => ['required', 'string', Rule::in(['post', 'listing', 'comment', 'user', 'video', 'conversation', 'message'])],
            'target_id' => ['required', 'uuid'],
            'reason' => ['required', 'string', Rule::in(ReportService::REASONS)],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
