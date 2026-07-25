<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LandingCard;
use App\Models\LandingSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;
use Modules\PublicContent\Services\LandingBlocksService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminLandingBlocksController extends Controller
{
    public function index(LandingBlocksService $landing): JsonResponse
    {
        return response()->json(['data' => $landing->adminPayload()]);
    }

    public function updateSection(Request $request, string $slug, AuditService $audit): JsonResponse
    {
        $section = LandingSection::query()->where('slug', $slug)->first();
        if (! $section) {
            throw new NotFoundHttpException('Секция не найдена.');
        }

        $data = $request->validate([
            'eyebrow' => ['nullable', 'string', 'max:120'],
            'title' => ['sometimes', 'string', 'max:200'],
            'subtitle' => ['nullable', 'string', 'max:2000'],
            'is_enabled' => ['sometimes', 'boolean'],
        ]);

        $old = $section->only(['eyebrow', 'title', 'subtitle', 'is_enabled']);
        $section->update($data);
        $audit->log($request->user(), 'admin.landing.section.update', $section, $old, $section->fresh()->only(['eyebrow', 'title', 'subtitle', 'is_enabled']), $request);

        return response()->json(['data' => $section->fresh()]);
    }

    public function storeCard(Request $request, AuditService $audit): JsonResponse
    {
        $data = $this->validateCard($request);

        $maxOrder = LandingCard::query()
            ->where('section_slug', $data['section_slug'])
            ->max('sort_order');

        $card = LandingCard::query()->create([
            ...$data,
            'sort_order' => ($maxOrder ?? -1) + 1,
        ]);

        $audit->log($request->user(), 'admin.landing.card.create', $card, null, $card->toArray(), $request);

        return response()->json(['data' => $card], 201);
    }

    public function updateCard(Request $request, int $id, AuditService $audit): JsonResponse
    {
        $card = LandingCard::query()->find($id);
        if (! $card) {
            throw new NotFoundHttpException('Карточка не найдена.');
        }

        $data = $this->validateCard($request, partial: true);
        $old = $card->toArray();
        $card->update($data);
        $audit->log($request->user(), 'admin.landing.card.update', $card, $old, $card->fresh()->toArray(), $request);

        return response()->json(['data' => $card->fresh()]);
    }

    public function destroyCard(int $id, AuditService $audit): JsonResponse
    {
        $card = LandingCard::query()->find($id);
        if (! $card) {
            throw new NotFoundHttpException('Карточка не найдена.');
        }

        $card->delete();
        $audit->log(request()->user(), 'admin.landing.card.delete', $card, $card->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Карточка удалена.']]);
    }

    public function reorderCards(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'section_slug' => ['required', 'string', Rule::in(['ecosystem', 'directions'])],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        DB::transaction(function () use ($data): void {
            foreach (array_values($data['ids']) as $index => $id) {
                LandingCard::query()
                    ->where('id', $id)
                    ->where('section_slug', $data['section_slug'])
                    ->update(['sort_order' => $index]);
            }
        });

        $audit->log($request->user(), 'admin.landing.cards.reorder', null, null, $data, $request);

        return response()->json(['data' => ['message' => 'Порядок сохранён.']]);
    }

    /** @return array<string, mixed> */
    private function validateCard(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'section_slug' => [$required, 'string', Rule::in(['ecosystem', 'directions'])],
            'title' => [$required, 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'icon' => ['nullable', 'string', 'max:64'],
            'icon_url' => ['nullable', 'string', 'max:500'],
            'link_url' => ['nullable', 'string', 'max:500'],
            'post_category_id' => ['nullable', 'integer', 'exists:post_categories,id'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }
}
