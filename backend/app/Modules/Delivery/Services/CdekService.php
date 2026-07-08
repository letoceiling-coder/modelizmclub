<?php

namespace Modules\Delivery\Services;

use AntistressStore\CdekSDK2\CdekClientV2;
use Modules\Delivery\Contracts\CdekGateway;

/**
 * Application-level CDEK gateway: SDK for covered endpoints, extension for gaps.
 */
class CdekService implements CdekGateway
{
    private ?CdekClientV2 $sdkClient = null;

    public function __construct(
        private readonly CdekClientFactory $factory,
        private readonly CdekApiExtension $extension,
    ) {}

    public function sdk(): CdekClientV2
    {
        return $this->sdkClient ??= $this->factory->make();
    }

    public function listOrders(array $query = []): array
    {
        return $this->extension->listOrders($query);
    }

    public function listIntakes(array $query = []): array
    {
        return $this->extension->listIntakes($query);
    }

    public function createPrealert(array $payload): array
    {
        return $this->extension->createPrealert($payload);
    }

    public function getPrealert(string $uuid): array
    {
        return $this->extension->getPrealert($uuid);
    }
}
