<?php

namespace Modules\Legal\Services;

use App\Models\LegalPage;
use App\Models\LegalPageRevision;
use App\Models\User;
use Illuminate\Support\Str;

class LegalPageContentService
{
    public function htmlFromMarkdown(string $markdown): string
    {
        return Str::markdown($markdown, [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
        ]);
    }

    public function snapshot(LegalPage $page, ?User $user): LegalPageRevision
    {
        return LegalPageRevision::query()->create([
            'legal_page_id' => $page->id,
            'version' => $page->version,
            'title' => $page->title,
            'meta_description' => $page->meta_description,
            'content_html' => $page->content_html,
            'content_md' => $page->content_md,
            'status' => $page->status->value,
            'user_id' => $user?->id,
            'created_at' => now(),
        ]);
    }
}
