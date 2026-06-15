<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faq_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('faq_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('faq_categories')->cascadeOnDelete();
            $table->string('question');
            $table->text('answer');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject');
            $table->string('status', 32)->default('open');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->boolean('is_staff')->default(false);
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index(['auditable_type', 'auditable_id']);
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->string('group', 64)->default('general');
            $table->timestamps();
        });

        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('subject');
            $table->longText('body_html');
            $table->json('variables')->nullable();
            $table->timestamps();
        });

        Schema::create('legal_documents', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->longText('body');
            $table->string('version', 32);
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_documents');
        Schema::dropIfExists('email_templates');
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('faq_articles');
        Schema::dropIfExists('faq_categories');
    }
};
