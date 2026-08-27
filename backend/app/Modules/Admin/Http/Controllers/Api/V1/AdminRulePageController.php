<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\LegalPageStatus;
use App\Http\Controllers\Controller;
use App\Models\RulePage;
use App\Models\RulePageRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Requests\UpsertRulePageRequest;
use Modules\Admin\Services\AuditService;
use Modules\Legal\Services\RulePageService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AdminRulePageController extends Controller
{
    public function __construct(
        private readonly RulePageService $rules,
    ) {}

    public function index(): JsonResponse
    {
        $items = RulePage::query()->orderBy('sort')->orderBy('id')->get();

        return response()->json([
            'data' => $items->map(fn (RulePage $p) => $this->rules->adminPayload($p)),
        ]);
    }

    public function store(UpsertRulePageRequest $request, AuditService $audit): JsonResponse
    {
        $data = $request->validated();
        $sections = $data['sections'] ?? [];
        unset($data['sections']);

        $page = RulePage::query()->create([
            ...$data,
            'status' => LegalPageStatus::Draft,
            'version' => 1,
            'sort' => $data['sort'] ?? 100,
        ]);
        $this->rules->replaceSections($page, is_array($sections) ? $sections : []);
        $this->rules->forgetCache($page->slug);
        $audit->log($request->user(), 'admin.rule_pages.create', $page, null, $page->toArray(), $request);

        return response()->json(['data' => $this->rules->adminPayload($page->fresh(['sections']) ?? $page)], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->rules->adminPayload($this->findPage($id))]);
    }

    public function update(UpsertRulePageRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $old = $page->toArray();
        $oldSlug = $page->slug;
        if ($page->isPublished() && ! $page->revisions()->exists()) {
            $this->rules->snapshot($page, $request->user());
        }
        $data = $request->validated();
        $sections = $data['sections'] ?? null;
        unset($data['sections']);

        $page->fill($data);
        $page->status = LegalPageStatus::Draft;
        $page->published_at = null;
        $page->save();
        if (is_array($sections)) {
            $this->rules->replaceSections($page, $sections);
        }
        $this->rules->forgetCache($oldSlug);
        if ($page->slug !== $oldSlug) {
            $this->rules->forgetCache($page->slug);
        }
        $audit->log($request->user(), 'admin.rule_pages.update', $page, $old, $page->fresh()->toArray(), $request);

        return response()->json(['data' => $this->rules->adminPayload($page->fresh(['sections']) ?? $page)]);
    }

    public function publish(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $old = $page->toArray();
        $page = $this->rules->publish($page, $request->user());
        $audit->log($request->user(), 'admin.rule_pages.publish', $page, $old, $page->toArray(), $request);

        return response()->json(['data' => $this->rules->adminPayload($page)]);
    }

    public function destroy(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $old = $page->toArray();
        $slug = $page->slug;
        $page->delete();
        $this->rules->forgetCache($slug);
        $audit->log($request->user(), 'admin.rule_pages.delete', null, $old, null, $request);

        return response()->json(['data' => ['ok' => true]]);
    }

    public function duplicate(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $copy = $this->rules->duplicate($page);
        $audit->log($request->user(), 'admin.rule_pages.duplicate', $copy, null, $copy->toArray(), $request);

        return response()->json(['data' => $this->rules->adminPayload($copy)], 201);
    }

    public function revisions(int $id): JsonResponse
    {
        $page = $this->findPage($id);
        $items = $page->revisions()->with('user:id,email')->limit(50)->get();

        return response()->json([
            'data' => $items->map(fn (RulePageRevision $r) => [
                'id' => $r->id,
                'version' => $r->version,
                'title' => $r->title,
                'status' => $r->status,
                'created_at' => $r->created_at?->toIso8601String(),
                'editor' => $r->user?->email,
            ]),
        ]);
    }

    public function restoreRevision(int $id, int $revisionId, Request $request, AuditService $audit): JsonResponse
    {
        $page = $this->findPage($id);
        $revision = RulePageRevision::query()
            ->where('rule_page_id', $page->id)
            ->where('id', $revisionId)
            ->first();
        if (! $revision) {
            throw new NotFoundHttpException('Версия не найдена.');
        }

        $old = $page->toArray();
        $page = $this->rules->restore($page, $revision, $request->user());
        $audit->log($request->user(), 'admin.rule_pages.restore', $page, $old, $page->toArray(), $request);

        return response()->json(['data' => $this->rules->adminPayload($page)]);
    }

    private function findPage(int $id): RulePage
    {
        $page = RulePage::query()->find($id);
        if (! $page) {
            throw new NotFoundHttpException('Страница не найдена.');
        }

        return $page;
    }
}
