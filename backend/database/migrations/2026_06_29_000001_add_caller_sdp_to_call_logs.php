<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('call_logs', function (Blueprint $table): void {
            $table->json('caller_sdp')->nullable()->after('media');
        });
    }

    public function down(): void
    {
        Schema::table('call_logs', function (Blueprint $table): void {
            $table->dropColumn('caller_sdp');
        });
    }
};
