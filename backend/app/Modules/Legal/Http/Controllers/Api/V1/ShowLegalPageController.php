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
            ->with('video')
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
                'meta_description' => $page->meta_description,
                /*
                 * Видео отдаётся только когда у файла есть адрес. Иначе
                 * страница отрисовала бы проигрыватель без источника —
                 * чёрный прямоугольник, который выглядит поломкой
                 * страницы, а не отсутствием записи.
                 */
                'video' => $page->video?->url ? [
                    'url' => $page->video->url,
                    'mime_type' => $page->video->mime_type,
                ] : null,
                'version' => $page->version,
                'published_at' => $page->published_at?->toIso8601String(),
            ],
        ]);
    }
}
