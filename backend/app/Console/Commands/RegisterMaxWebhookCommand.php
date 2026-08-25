<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Auth\Services\MaxAuthService;
use Modules\Auth\Services\MaxBotClient;

class RegisterMaxWebhookCommand extends Command
{
    protected $signature = 'max:register-webhook';

    protected $description = 'Subscribe the MAX bot webhook for website login';

    public function handle(MaxBotClient $bot, MaxAuthService $auth): int
    {
        if (! $bot->isConfigured()) {
            $this->error('MAX_BOT_TOKEN / MAX_BOT_USERNAME are not set.');

            return self::FAILURE;
        }

        $secret = (string) config('services.max.webhook_secret');
        if ($secret === '') {
            $this->error('MAX_WEBHOOK_SECRET is empty. Add it to .env (A-Z a-z 0-9 _ - , 5-256 chars).');

            return self::FAILURE;
        }

        $url = $auth->webhookUrl();
        $this->info("Registering webhook: {$url}");

        $result = $bot->subscribeWebhook($url, $secret, [
            'bot_started',
            'message_callback',
            'message_created',
        ]);

        $this->line(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) ?: '{}');

        return self::SUCCESS;
    }
}
