<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LegalPage;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ShowLegalPageController extends Controller
{
    public function __invoke(string $slug): JsonResponse
    {
        $page = LegalPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (! $page) {
            throw new NotFoundHttpException('Документ не найден.');
        }

        return response()->json([
            'data' => [
                'slug' => $page->slug,
                'title' => $page->title,
                'content_html' => $page->content_html,
                'version' => $page->version,
                'published_at' => $page->published_at?->toIso8601String(),
            ],
        ]);
    }
}
