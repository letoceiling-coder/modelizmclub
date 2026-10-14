<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('phone_verification_codes', function (Blueprint $table): void {
            $table->uuid('session_id')->nullable()->unique()->after('id');
            $table->string('channel', 20)->default('classic')->after('phone');
            $table->string('phase', 32)->default('awaiting_sms')->after('channel');
            $table->string('iqsms_message_id', 32)->nullable()->after('phase');
            $table->text('otp_token')->nullable()->after('iqsms_message_id');
        });
    }

    public function down(): void
    {
        Schema::table('phone_verification_codes', function (Blueprint $table): void {
            $table->dropColumn(['session_id', 'channel', 'phase', 'iqsms_message_id', 'otp_token']);
        });
    }
};
