<?php

namespace App\Services\Sms;

interface SmsSender
{
    /**
     * @param  array<string, mixed>  $options  iqSMS: status_callback_url, client_id
     * @return array<string, mixed> Gateway-specific response payload
     */
    public function send(string $phone, string $text, array $options = []): array;

    /**
     * Есть ли доступы, чтобы шлюз мог отправлять.
     *
     * Отвечает сам драйвер. Раньше это решала диагностика отдельным
     * перечислением драйверов по именам, с откатом к iqsms для всего
     * незнакомого: у нового провайдера с пустыми доступами страница
     * показывала зелёную точку и «настроен: да», потому что смотрела на
     * чужие ключи. И третий провайдер требовал правки кода не только в
     * реестре, но и там — то есть задача «подключается настройкой» была
     * закрыта наполовину.
     */
    public function isConfigured(): bool;
}
