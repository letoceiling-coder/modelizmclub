<?php

namespace Tests\Unit;

use App\Support\FeedGuestAccessRegistry;
use PHPUnit\Framework\TestCase;

/**
 * Реестр объявляет то решение, которое действует на проде.
 *
 * До 01.10 каждая выкатка печатала «10 расхождений с умолчаниями
 * реестра», и ни одно не было названо словами. Пока расхождений десять
 * и они безымянные, сверка не работает: одиннадцатое настоящее утонет
 * среди десяти привычных.
 *
 * Разбор по строкам — `docs/access-map-2026-10-01.md`. Все десять
 * сделаны из `/admin` учётной записью 508 между 24.08 и 10.09 и
 * складываются в одно решение: разделы сообщества уходят под подписку,
 * действия с записями открываются просто вошедшему.
 *
 * Эта проверка держит реестр на том же решении. Если его меняют —
 * меняют осознанно, вместе с разбором, а не случайно вместе с чем-то
 * ещё.
 */
class AccessMapRegistryMatchesDecisionTest extends TestCase
{
    /** Ключ → объявленный уровень. Источник — решение 24.08–10.09. */
    private const DECISION = [
        // Действия с записью: вошедшему, не подписчику.
        'feed.post.comment' => 'auth',
        'feed.post.like' => 'auth',
        'feed.post.repost' => 'auth',
        // Разделы сообщества: по подписке.
        'layout.nav.reviews' => 'subscription',
        'route.reviews' => 'subscription',
        'layout.nav.channels' => 'subscription',
        'layout.nav.communities' => 'subscription',
    ];

    public function test_семь_уровней_объявлены_так_как_действуют(): void
    {
        $действия = FeedGuestAccessRegistry::defaultConfig()['actions'];

        foreach (self::DECISION as $ключ => $уровень) {
            $this->assertArrayHasKey($ключ, $действия, "ключ «{$ключ}» исчез из реестра");
            $this->assertSame(
                $уровень,
                $действия[$ключ]['min_tier'],
                "«{$ключ}»: реестр расходится с решением — см. docs/access-map-2026-10-01.md",
            );
        }
    }

    public function test_окно_говорит_про_подписку_а_не_про_вход(): void
    {
        $окно = FeedGuestAccessRegistry::defaultConfig()['popup'];

        // За стеной стоит подписка, и окно не должно звать «Войти».
        $this->assertSame('Нужна подписка', $окно['title']);
        $this->assertStringContainsString('подписку', $окно['description']);
        $this->assertSame('Оформить подписку', $окно['primary_cta']);
    }

    /**
     * Противоречие, оставленное решением заказчика, — но записанное.
     *
     * Пункт меню требует подписки, а страница за ним открыта гостю:
     * ссылку не видно, а по прямому адресу страница откроется. Оба
     * значения выставлены руками, это не след правки. Пока выбор не
     * сделан, проверка держит состояние как есть — чтобы оно не
     * «исправилось» молча в одну из двух сторон.
     */
    public function test_несогласованность_меню_и_страницы_зафиксирована(): void
    {
        $действия = FeedGuestAccessRegistry::defaultConfig()['actions'];

        foreach (['channels', 'communities'] as $раздел) {
            $this->assertSame(
                'subscription',
                $действия["layout.nav.{$раздел}"]['min_tier'],
                "пункт меню «{$раздел}» изменён — обновите docs/access-map-2026-10-01.md",
            );
            $this->assertSame(
                'guest',
                $действия["route.{$раздел}"]['min_tier'],
                "страница «{$раздел}» изменена — обновите docs/access-map-2026-10-01.md",
            );
        }
    }
}
