<?php

namespace App\Services\Sms;

interface SmsSender
{
    /** @return array<string, mixed> Gateway-specific response payload */
    public function send(string $phone, string $text): array;
}
