<?php

namespace Modules\Delivery\Services;

use Illuminate\Contracts\Cache\Repository as CacheRepository;

/**
 * Persists CDEK OAuth token between requests (same format as SDK setMemory).
 */
class CdekTokenCache
{
    public function __construct(
        private readonly CacheRepository $cache,
    ) {}

    /**
     * @return array{expires_in:int,access_token:string,account_type:string}|null
     */
    public function get(): ?array
    {
        $payload = $this->cache->get($this->key());

        if (! is_array($payload)) {
            return null;
        }

        if (
            ! isset($payload['expires_in'], $payload['access_token'], $payload['account_type'])
            || ! is_int($payload['expires_in'])
            || ! is_string($payload['access_token'])
            || ! is_string($payload['account_type'])
        ) {
            return null;
        }

        return $payload;
    }

    /**
     * @param  array{expires_in:int,access_token:string,account_type:string}  $auth
     */
    public function put(array $auth): void
    {
        $ttl = max(60, (int) config('cdek.token_cache_ttl_seconds', 3500));
        $this->cache->put($this->key(), $auth, $ttl);
    }

    public function forget(): void
    {
        $this->cache->forget($this->key());
    }

    private function key(): string
    {
        $suffix = config('cdek.test') ? 'test' : 'prod';

        return (string) config('cdek.token_cache_key', 'cdek:oauth:token').':'.$suffix;
    }
}
