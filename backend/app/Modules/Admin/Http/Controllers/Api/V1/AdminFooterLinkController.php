<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FooterLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Requests\UpsertFooterLinkRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminFooterLinkController extends Controller
{
    public function index(): JsonResponse
    {
        $items = FooterLink::query()->orderBy('group')->orderBy('sort')->get();

        return response()->json([
            'data' => $items->map(fn (FooterLink $l) => $this->toArray($l)),
        ]);
    }

    public function store(UpsertFooterLinkRequest $request, AuditService $audit): JsonResponse
    {
        $link = FooterLink::query()->create($request->validated());
        $audit->log($request->user(), 'admin.footer_links.create', $link, null, $link->toArray(), $request);

        return response()->json(['data' => $this->toArray($link)], 201);
    }

    public function update(UpsertFooterLinkRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $link = FooterLink::query()->find($id);
        if (! $link) {
            throw new NotFoundHttpException('Ссылка не найдена.');
        }

        $old = $link->toArray();
        $link->update($request->validated());
        $audit->log($request->user(), 'admin.footer_links.update', $link, $old, $link->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($link->fresh())]);
    }

    public function destroy(int $id, AuditService $audit): JsonResponse
    {
        $link = FooterLink::query()->find($id);
        if (! $link) {
            throw new NotFoundHttpException('Ссылка не найдена.');
        }

        $link->delete();
        $audit->log(request()->user(), 'admin.footer_links.delete', $link, $link->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Ссылка удалена.']]);
    }

    public function reorder(Request $request, AuditService $audit): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'integer'],
            'items.*.sort' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($validated['items'] as $row) {
            FooterLink::query()->whereKey($row['id'])->update(['sort' => $row['sort']]);
        }

        $audit->log($request->user(), 'admin.footer_links.reorder', null, null, $validated, $request);

        return response()->json(['data' => ['message' => 'Порядок обновлён.']]);
    }

    /** @return array<string, mixed> */
    private function toArray(FooterLink $link): array
    {
        return [
            'id' => $link->id,
            'group' => $link->group,
            'label' => $link->label,
            'target_type' => $link->target_type,
            'target_value' => $link->target_value,
            'sort' => $link->sort,
            'is_visible' => $link->is_visible,
        ];
    }
}
