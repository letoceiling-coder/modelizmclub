<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\LegalPageStatus;
use App\Http\Controllers\Controller;
use App\Models\LegalPage;
use App\Models\LegalPageRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Requests\UpsertLegalPageRequest;
use Modules\Admin\Services\AuditService;
use Modules\Legal\Services\LegalPageContentService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminLegalPageController extends Controller
{
    public function __construct(
        private readonly LegalPageContentService $content,
    ) {}

    public function index(): JsonResponse
    {
        $items = LegalPage::query()->orderBy('slug')->get();

        return response()->json([
            'data' => $items->map(fn (LegalPage $p) => $this->toArray($p)),
        ]);
    }

    public function store(UpsertLegalPageRequest $request, AuditService $audit): JsonResponse
    {
        $payload = $this->payloadFromRequest($request);
        $page = LegalPage::query()->create([
            ...$payload,
            'status' => LegalPageStatus::Draft,
            'version' => 1,
        ]);
        $audit->log($request->user(), 'admin.legal_pages.create', $page, null, $page->toArray(), $request);

        return response()->json(['data' => $this->toArray($page)], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->toArray($this->findPage($id))]);
    }

    public function update(UpsertLegalPageRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $old = $page->toArray();
        $this->content->snapshot($page, $request->user());

        $page->fill($this->payloadFromRequest($request));
        $page->version = $page->version + 1;
        $page->status = LegalPageStatus::Draft;
        $page->published_at = null;
        $page->save();

        $audit->log($request->user(), 'admin.legal_pages.update', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($page->fresh())]);
    }

    public function publish(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
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
        $page = $this->findPage($id);
        $old = $page->toArray();
        $page->update(['status' => LegalPageStatus::Archived]);
        $audit->log($request->user(), 'admin.legal_pages.archive', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($page->fresh())]);
    }

    public function revisions(int $id): JsonResponse
    {
        $page = $this->findPage($id);
        $items = $page->revisions()->with('user:id,email')->limit(50)->get();

        return response()->json([
            'data' => $items->map(fn (LegalPageRevision $r) => $this->revisionToArray($r)),
        ]);
    }

    public function restoreRevision(int $id, int $revisionId, Request $request, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $revision = LegalPageRevision::query()
            ->where('legal_page_id', $page->id)
            ->where('id', $revisionId)
            ->first();
        if (! $revision) {
            throw new NotFoundHttpException('Версия не найдена.');
        }

        $old = $page->toArray();
        $this->content->snapshot($page, $request->user());

        $page->fill([
            'title' => $revision->title,
            'meta_description' => $revision->meta_description,
            'content_html' => $revision->content_html,
            'content_md' => $revision->content_md,
        ]);
        $page->version = $page->version + 1;
        $page->status = LegalPageStatus::Draft;
        $page->published_at = null;
        $page->save();

        $audit->log($request->user(), 'admin.legal_pages.restore', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toArray($page->fresh())]);
    }

    public function previewMarkdown(Request $request): JsonResponse
    {
        $data = $request->validate([
            'content_md' => ['required', 'string'],
        ]);

        return response()->json([
            'data' => ['content_html' => $this->content->htmlFromMarkdown($data['content_md'])],
        ]);
    }

    /** @return array<string, mixed> */
    private function payloadFromRequest(UpsertLegalPageRequest $request): array
    {
        $data = $request->validated();
        $markdown = isset($data['content_md']) && is_string($data['content_md']) ? trim($data['content_md']) : '';
        if ($markdown !== '') {
            $data['content_md'] = $markdown;
            $data['content_html'] = $this->content->htmlFromMarkdown($markdown);
        } else {
            $data['content_md'] = $data['content_md'] ?? null;
        }

        return $data;
    }

    private function findPage(int $id): LegalPage
    {
        $page = LegalPage::query()->find($id);
        if (! $page) {
            throw new NotFoundHttpException('Страница не найдена.');
        }

        return $page;
    }

    /** @return array<string, mixed> */
    private function toArray(LegalPage $page): array
    {
        return [
            'id' => $page->id,
            'slug' => $page->slug,
            'title' => $page->title,
            'meta_description' => $page->meta_description,
            'content_html' => $page->content_html,
            'content_md' => $page->content_md,
            'status' => $page->status->value,
            'version' => $page->version,
            'published_at' => $page->published_at?->toIso8601String(),
            'updated_at' => $page->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function revisionToArray(LegalPageRevision $revision): array
    {
        return [
            'id' => $revision->id,
            'version' => $revision->version,
            'title' => $revision->title,
            'status' => $revision->status,
            'created_at' => $revision->created_at?->toIso8601String(),
            'editor' => $revision->user?->email,
        ];
    }
}
