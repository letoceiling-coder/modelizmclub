<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\CategoryOrder;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;

/**
 * Переключатель «по алфавиту / вручную».
 *
 * Своей ручкой, а не строкой в общих настройках: настройки лежат в
 * разделе «Система», а дерево правят из «Категорий», и модератору,
 * которому выдано дерево, раздел настроек может быть закрыт. Переключатель,
 * до которого не дотянуться с того же экрана, — не переключатель.
 *
 * Выбор влияет на весь сайт, а не только на админку, поэтому он в аудите.
 */
#[Group('Admin — Categories', weight: 41)]
class AdminCategorySortModeController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => ['mode' => CategoryOrder::mode()]]);
    }

    public function update(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'mode' => ['required', Rule::in([CategoryOrder::ALPHA, CategoryOrder::MANUAL])],
        ]);

        $было = CategoryOrder::mode();
        $стало = CategoryOrder::set($data['mode']);

        $audit->log(
            $request->user(),
            'admin.categories.sort_mode',
            null,
            ['mode' => $было],
            ['mode' => $стало],
            $request,
        );

        return response()->json(['data' => ['mode' => $стало]]);
    }
}
