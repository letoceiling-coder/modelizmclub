<?php

namespace Tests\Feature;

use Modules\Delivery\Services\Carriers\YandexDeliveryAdapter;
use Modules\Delivery\Services\YandexDeliveryService;
use Mockery;
use Tests\TestCase;

/**
 * `geo_id` уходит в Яндекс числом, а не строкой.
 *
 * Замер прода 10.10: `GET /api/v1/delivery/yandex/pickup-points?geo_id=213`
 * (Москва) отвечал 500 за 0,86 с. В журнале сервера — причина словами:
 *
 *     "message":"Error at path 'geo_id': Wrong type.
 *                Expected: kIntValue, actual: kStringValue"
 *
 * То есть пункты выдачи Яндекса не работали вовсе: ни с городом, ни без
 * него. Починка 09.10 (`bc53a589`) сделала место обязательным и закрыла
 * падение по памяти — но запрос с местом всё равно не проходил, и этого
 * никто не заметил, потому что проверяли отказ без места.
 *
 * Откуда брался тип. Значение приходит из строки запроса, где всё строки, а
 * правило `'geo_id' => ['integer']` в `$request->validate()` только
 * проверяет, что строка похожа на число. Приводить тип оно не обязано и не
 * приводит. Правило при этом читается как приведение — в этом и ловушка.
 *
 * Проверка смотрит на тело запроса к Яндексу, а не на ответ: ответ подменён,
 * и утверждать по нему что-либо о типах нельзя.
 */
class YandexGeoIdIsANumberTest extends TestCase
{
    /** @return array<string, mixed> Тело, ушедшее в Яндекс. */
    private function телоЗапроса(array $filters): array
    {
        $ушло = [];

        $this->mock(YandexDeliveryService::class, function ($mock) use (&$ушло): void {
            $mock->shouldReceive('listPickupPoints')
                ->andReturnUsing(function (array $body) use (&$ушло): array {
                    $ушло = $body;

                    return ['points' => []];
                });
        });

        app(YandexDeliveryAdapter::class)->listPickupPoints($filters);

        return $ушло;
    }

    public function test_geo_id_uhodit_chislom(): void
    {
        // Ровно так значение и приходит после `$request->validate()`:
        // строкой, прошедшей проверку «похоже на число».
        $тело = $this->телоЗапроса(['geo_id' => '213']);

        $this->assertArrayHasKey('geo_id', $тело);
        $this->assertIsInt(
            $тело['geo_id'],
            'geo_id ушёл строкой — Яндекс ответит «Expected: kIntValue, actual: kStringValue» и 500.',
        );
        $this->assertSame(213, $тело['geo_id']);
    }

    public function test_geo_id_chislom_tozhe_prohodit(): void
    {
        $тело = $this->телоЗапроса(['geo_id' => 213]);

        $this->assertIsInt($тело['geo_id']);
        $this->assertSame(213, $тело['geo_id']);
    }

    /** Без места ключа быть не должно: `array_filter` его убирает. */
    public function test_bez_mesta_geo_id_ne_otpravliaetsia(): void
    {
        $тело = $this->телоЗапроса(['latitude' => 55.75, 'longitude' => 37.61]);

        $this->assertArrayNotHasKey('geo_id', $тело);
        $this->assertArrayHasKey('latitude', $тело);
        $this->assertArrayHasKey('longitude', $тело);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
