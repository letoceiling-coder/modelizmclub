<?php

namespace Modules\Delivery\Contracts;

use AntistressStore\CdekSDK2\CdekClientV2;

/**
 * Unified access to CDEK API v2: SDK methods + project extensions.
 *
 * @see https://apidoc.cdek.ru/
 */
interface CdekGateway
{
    /** Low-level SDK client (calculator, PVZ, orders, print, webhooks, …). */
    public function sdk(): CdekClientV2;

    /**
     * GET /v2/orders — список заказов с фильтрами.
     *
     * @param  array<string, scalar|null>  $query
     * @return array<string, mixed>
     */
    public function listOrders(array $query = []): array;

    /**
     * GET /v2/intakes — список заявок на вызов курьера.
     *
     * @param  array<string, scalar|null>  $query
     * @return array<string, mixed>
     */
    public function listIntakes(array $query = []): array;

    /**
     * POST /v2/prealert — регистрация преалерта.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createPrealert(array $payload): array;

    /**
     * GET /v2/prealert/{uuid} — информация о преалерте.
     *
     * @return array<string, mixed>
     */
    public function getPrealert(string $uuid): array;
}
