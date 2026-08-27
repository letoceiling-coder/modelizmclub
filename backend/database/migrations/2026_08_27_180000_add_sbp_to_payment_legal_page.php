<?php

use App\Models\LegalPage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('legal_pages')) {
            return;
        }

        $path = database_path('seeders/data/legal/payment.html');
        if (! File::exists($path)) {
            return;
        }

        $html = File::get($path);
        LegalPage::query()->where('slug', 'payment')->update([
            'content_html' => $html,
        ]);
    }

    public function down(): void
    {
        // Content snapshot; no reverse.
    }
};
