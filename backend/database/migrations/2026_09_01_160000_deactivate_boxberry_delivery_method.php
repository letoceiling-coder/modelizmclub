<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('delivery_methods')->where('code', 'boxberry')->update(['is_active' => false]);
    }

    public function down(): void
    {
        DB::table('delivery_methods')->where('code', 'boxberry')->update(['is_active' => true]);
    }
};
