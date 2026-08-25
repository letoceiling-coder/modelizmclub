<?php

namespace Modules\Auth\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MaxBotClient
{
    public function isConfigured(): bool
    {
        return filled(config('services.max.bot_token'))
            && filled(config('services.max.bot_username'));
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function sendMessage(array $body, array $query): array
    {
        return $this->request('POST', '/messages', $body, $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function answerCallback(string $callbackId, array $body): array
    {
        return $this->request('POST', '/answers', $body, ['callback_id' => $callbackId]);
    }

    /**
     * @param  list<string>  $updateTypes
     * @return array<string, mixed>
     */
    public function subscribeWebhook(string $url, string $secret, array $updateTypes): array
    {
        return $this->request('POST', '/subscriptions', [
            'url' => $url,
            'update_types' => $updateTypes,
            'secret' => $secret,
        ]);
    }

    /** @return array<string, mixed> */
    public function listSubscriptions(): array
    {
        return $this->request('GET', '/subscriptions');
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $body = [], array $query = []): array
    {
        $token = (string) config('services.max.bot_token');
        if ($token === '') {
            throw new \RuntimeException('MAX_BOT_TOKEN is not configured.');
        }

        $base = rtrim((string) config('services.max.api_base', 'https://platform-api2.max.ru'), '/');

        $pending = Http::timeout(8)
            ->retry(2, 200)
            ->withHeaders([
                'Authorization' => $token,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ]);

        $url = $base.$path;
        $response = $method === 'GET'
            ? $pending->get($url, $query)
            : $pending->withQueryParameters($query)->post($url, $body);

        return $this->decode($response, $path);
    }

    /** @return array<string, mixed> */
    private function decode(Response $response, string $path): array
    {
        $payload = $response->json();
        if (! is_array($payload)) {
            $payload = [];
        }

        if ($response->failed()) {
            Log::warning('MAX API request failed', [
                'path' => $path,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('MAX API error HTTP '.$response->status());
        }

        return $payload;
    }
}
