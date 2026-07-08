<?php

namespace Modules\Delivery\Services;

use AntistressStore\CdekSDK2\CdekClientV2;
use RuntimeException;

class CdekClientFactory
{
    public function __construct(
        private readonly CdekTokenCache $tokenCache,
    ) {}

    public function make(): CdekClientV2
    {
        if (! config('cdek.enabled')) {
            throw new RuntimeException('CDEK integration is disabled (CDEK_ENABLED=false).');
        }

        $timeout = (float) config('cdek.timeout', 10.0);
        $test = (bool) config('cdek.test', true);

        if ($test) {
            $client = new CdekClientV2('TEST', null, $timeout);
            $accountType = 'TEST';
        } else {
            $account = (string) config('cdek.account');
            $secure = (string) config('cdek.secure');

            if ($account === '' || $secure === '') {
                throw new RuntimeException('CDEK_ACCOUNT and CDEK_SECURE must be set for production mode.');
            }

            $client = new CdekClientV2($account, $secure, $timeout);
            $accountType = 'COMBAT';
        }

        $memory = $this->tokenCache->get();
        if ($memory !== null && $memory['account_type'] !== $accountType) {
            $this->tokenCache->forget();
            $memory = null;
        }

        $client->setMemory($memory, function (array $data) use ($accountType): bool {
            if (! isset($data['cdekAuth']) || ! is_array($data['cdekAuth'])) {
                return false;
            }

            $auth = $data['cdekAuth'];
            if (! isset($auth['expires_in'], $auth['access_token'])) {
                return false;
            }

            $this->tokenCache->put([
                'expires_in' => (int) $auth['expires_in'],
                'access_token' => (string) $auth['access_token'],
                'account_type' => $accountType,
            ]);

            return true;
        });

        return $client;
    }
}
