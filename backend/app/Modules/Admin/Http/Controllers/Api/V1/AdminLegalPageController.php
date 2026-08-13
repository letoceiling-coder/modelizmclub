<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\LegalPageStatus;
use App\Http\Controllers\Controller;
use App\Models\LegalPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Requests\UpsertLegalPageRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminLegalPageController extends Controller
{
    public function index(): JsonResponse
    {
        $items = LegalPage::query()->orderBy('slug')->get();

        return response()->json([
            'data' => $items->map(fn (LegalPage $p) => $this->toArray($p)),
        ]);
    }

    public function store(UpsertLegalPageRequest $request, AuditService $audit): JsonResponse
    {
        $page = LegalPage::query()->create([
            ...$request->validated(),
            'status' => LegalPageStatus::Draft,
            'version' => 1,
        ]);
        $audit->log($request->user(), 'admin.legal_pages.create', $page, null, $page->toArray(), $request);

        return response()->json(['data' => $this->toArray($page)], 201);
    }

    public function show(int $id): JsonResponse
    {
        $page = LegalPage::query()->find($id);
        if (! $page) {
            throw new NotFoundHttpException('Страница не найдена.');
        }

        return response()->json(['data' => $this->toArray($page)]);
    }

    public function update(UpsertLegalPageRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $page = LegalPage::query()->find($id);
        if (! $page) {
            throw new NotFoundHttpException('Страница не найдена.');
        }

        $old = $page->toArray();
        $page->fill($request->validated());
        $page->version = $page->version + 1;
        $page->status = LegalPageStatus::Draft;
        $page->published_at = null;
        $page->save();

        $audit->log($request->user(), 'admin.legal_pages.update', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($page->fresh())]);
    }

    public function publish(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $page = LegalPage::query()->find($id);
        if (! $page) {
            throw new NotFoundHttpException('Страница не найдена.');
        }

        $old = $page->toArray();
        $page->update([
            'status' => LegalPageStatus::Published,
            'published_at' => now(),
        ]);
        $audit->log($request->user(), 'admin.legal_pages.publish', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($page->fresh())]);
    }

    public function archive(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $page = LegalPage::query()->find($id);
        if (! $page) {
            throw new NotFoundHttpException('Страница не найдена.');
        }

        $old = $page->toArray();
        $page->update(['status' => LegalPageStatus::Archived]);
        $audit->log($request->user(), 'admin.legal_pages.archive', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($page->fresh())]);
    }

    /** @return array<string, mixed> */
    private function toArray(LegalPage $page): array
    {
        return [
            'id' => $page->id,
            'slug' => $page->slug,
            'title' => $page->title,
            'content_html' => $page->content_html,
            'status' => $page->status->value,
            'version' => $page->version,
            'published_at' => $page->published_at?->toIso8601String(),
            'updated_at' => $page->updated_at?->toIso8601String(),
        ];
    }
}
