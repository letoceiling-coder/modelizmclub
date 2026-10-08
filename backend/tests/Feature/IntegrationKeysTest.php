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
            [
                'yandex_maps_key' => '',
                'metrika_id' => '',
                'yandex_verification' => '',
                'google_verification' => '',
            ],
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
            [
                'yandex_maps_key' => 'abc-123',
                'metrika_id' => '98765432',
                'yandex_verification' => '',
                'google_verification' => '',
            ],
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

    /**
     * Код подтверждения прав копируют целым тегом.
     *
     * В Вебмастере Яндекса и в Search Console его дают готовой строкой
     * `<meta name="yandex-verification" content="abc123" />`, и вставят её
     * целиком — так короче, чем выковыривать значение. С тегом внутри
     * `content` разметка выходит сломанной, а подтверждение не проходит,
     * причём Вебмастер отвечает «тег не найден», то есть на настоящую
     * причину не указывает.
     */
    public function test_a_verification_code_pasted_as_a_whole_tag_is_unwrapped(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => [
                'yandex_verification' => '<meta name="yandex-verification" content="d1e2f3a4b5" />',
                'google_verification' => "<meta name='google-site-verification' content='G-abc_123' />",
            ], 'group' => 'integrations'],
        );

        $keys = IntegrationKeys::publicPayload();
        $this->assertSame('d1e2f3a4b5', $keys['yandex_verification']);
        $this->assertSame('G-abc_123', $keys['google_verification']);
    }

    /** Вставленное одним значением остаётся как есть, без пробелов по краям. */
    public function test_a_verification_code_pasted_as_a_bare_value_is_kept(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['yandex_verification' => '  d1e2f3a4b5  '], 'group' => 'integrations'],
        );

        $this->assertSame('d1e2f3a4b5', IntegrationKeys::publicPayload()['yandex_verification']);
    }

    /**
     * Пустая настройка даёт пустую строку, а не пробел и не тег.
     *
     * Фронтенд по пустому значению тега не рисует вовсе: пустой `content`
     * Вебмастер считает неверным кодом.
     */
    public function test_an_empty_verification_code_stays_empty(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => ['yandex_verification' => '   ', 'google_verification' => null], 'group' => 'integrations'],
        );

        $keys = IntegrationKeys::publicPayload();
        $this->assertSame('', $keys['yandex_verification']);
        $this->assertSame('', $keys['google_verification']);
    }

    /** Коды доезжают до фронтенда тем же ответом, что ключ карт. */
    public function test_verification_codes_reach_the_public_bootstrap(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => IntegrationKeys::SETTING_KEY],
            ['value' => [
                'yandex_verification' => 'ya-code-1',
                'google_verification' => 'g-code-1',
            ], 'group' => 'integrations'],
        );
        PublicBootstrapService::forget();

        $this->getJson('/api/v1/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.integration_keys.yandex_verification', 'ya-code-1')
            ->assertJsonPath('data.integration_keys.google_verification', 'g-code-1');
    }
}
