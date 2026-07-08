<?php

namespace Modules\Delivery\Contracts;

interface YandexGateway
{
    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function listPickupPoints(array $body): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function detectLocation(array $body): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function calculatePrice(array $body): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function createOffer(array $body): array;

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function getRequestInfo(array $query): array;
}
