<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use App\Support\IntegrationKeys;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\PublicContent\Services\PublicBootstrapService;
use Tests\TestCase;

/**
 * Ключи сторонних сервисов включаются подстановкой значения, без выкатки.
 *
 * До 25.09 они жили в `import.meta.env` фронтенда, то есть вшивались в
 * сборку: вставить ключ значило пересобрать и выкатить. Без них карта
 * пунктов СДЭК не загружалась и статистика не собиралась вовсе.
 */
class IntegrationKeysTest extends TestCase
{
    use RefreshDatabase;

    public function test_empty_when_nothing_is_set(): void
    {
        $this->assertSame(
            ['yandex_maps_key' => '', 'metrika_id' => ''],
            IntegrationKeys::publicPayload(),
        );
    }

    public function test_it_reads_what_the_owner_pasted(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['yandex_maps_key' => 'abc-123', 'metrika_id' => '98765432'], 'group' => 'integrations'],
        );

        $this->assertSame(
            ['yandex_maps_key' => 'abc-123', 'metrika_id' => '98765432'],
            IntegrationKeys::publicPayload(),
        );
    }

    /**
     * Номер счётчика чистится от постороннего.
     *
     * Из кабинета Метрики его копируют вместе с подписью, пробелами, а то
     * и всей строкой кода. Счётчик с мусором в номере молча не заводится,
     * и понять это можно только по отсутствию визитов через сутки.
     */
    public function test_the_counter_number_is_cleaned(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['metrika_id' => ' Номер счётчика: 98 765 432 '], 'group' => 'integrations'],
        );

        $this->assertSame('98765432', IntegrationKeys::publicPayload()['metrika_id']);
    }

    /** Ключ карт — только обрезка пробелов: в нём бывают дефисы и буквы. */
    public function test_the_maps_key_keeps_its_shape(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['yandex_maps_key' => '  1a2b3c-4d5e-6f  '], 'group' => 'integrations'],
        );

        $this->assertSame('1a2b3c-4d5e-6f', IntegrationKeys::publicPayload()['yandex_maps_key']);
    }

    /** Ключи доезжают до фронтенда — он читает их из этого ответа. */
    public function test_the_keys_reach_the_public_bootstrap(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['yandex_maps_key' => 'map-key', 'metrika_id' => '12345'], 'group' => 'integrations'],
        );
        PublicBootstrapService::forget();

        $this->getJson('/api/v1/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.integration_keys.yandex_maps_key', 'map-key')
            ->assertJsonPath('data.integration_keys.metrika_id', '12345');
    }

    /**
     * Вставка действует без выкатки: кеш ответа сбрасывается сам.
     *
     * Ради этого всё и затевалось. `SystemSetting` уже умеет сбрасывать
     * кеш `/public/bootstrap` по событию модели — проверяем, что это
     * работает и для ключей.
     */
    public function test_pasting_a_key_takes_effect_without_a_deploy(): void
    {
        $this->getJson('/api/v1/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.integration_keys.metrika_id', '');

        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['metrika_id' => '55555'], 'group' => 'integrations'],
        );

        $this->getJson('/api/v1/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.integration_keys.metrika_id', '55555');
    }
}
