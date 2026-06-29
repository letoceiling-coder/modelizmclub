<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_logs', function (Blueprint $table): void {
            // Client-generated id used for idempotent ingestion: a re-sent batch
            // (e.g. after a failed flush or from a second tab) is dropped instead
            // of being stored twice.
            $table->string('client_id', 64)->nullable()->after('id');
            $table->unique('client_id');
        });
    }

    public function down(): void
    {
        Schema::table('client_logs', function (Blueprint $table): void {
            $table->dropUnique(['client_id']);
            $table->dropColumn('client_id');
        });
    }
};
