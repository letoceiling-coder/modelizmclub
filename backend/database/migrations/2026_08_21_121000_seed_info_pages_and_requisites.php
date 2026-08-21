<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        (new \Database\Seeders\LegalComplianceSeeder())->run();
    }

    public function down(): void
    {
        // Content is admin-owned after seed; do not drop pages on rollback.
    }
};
