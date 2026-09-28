<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Catalog\Services\CatalogService;

/**
 * Сбросить кеш каталога: деревья категорий и список городов.
 *
 * ПОЧЕМУ КОМАНДА, А НЕ `tinker --execute`. Сначала выкатка звала именно
 * tinker — и на проде он падает: psysh пишет свою настройку в
 * `$HOME/.config/psysh`, а у `www-data` домашнего каталога нет, и
 * получается «Writing to directory /var/www/.config/psysh is not
 * allowed». Ошибка не про кеш и не про каталог, найти её по этому тексту
 * можно только зная, что искать.
 *
 * Обычная команда обходится без psysh, называется тем, что делает, и её
 * можно позвать руками, не вспоминая полное имя класса.
 *
 * Сбрасывать безопасно в любой момент: всё, что лежит под этими ключами,
 * — производное, и первый же запрос соберёт его заново одним SQL.
 */
class FlushCatalogCacheCommand extends Command
{
    protected $signature = 'catalog:flush-cache';

    protected $description = 'Сбрасывает кеш деревьев категорий и городов (TTL у них сутки)';

    public function handle(): int
    {
        CatalogService::flushCache();

        $this->info('catalog:flush-cache: кеш каталога сброшен');

        return self::SUCCESS;
    }
}
