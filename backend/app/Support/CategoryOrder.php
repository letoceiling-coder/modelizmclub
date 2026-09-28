<?php

namespace App\Support;

use App\Models\SystemSetting;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Modules\Catalog\Services\CatalogService;

/**
 * Порядок категорий: по алфавиту или вручную.
 *
 * ОДНО МЕСТО НА ВЕСЬ САЙТ. Порядок решается здесь и только здесь, и тот
 * же метод зовут админка, каталог объявлений, лента, сообщества, форма
 * подачи и список обзоров. Иначе «сверить, что порядок совпадает»
 * превращается в сверку двух независимых реализаций, а они расходятся
 * тихо — не поломкой, а просто другим порядком.
 *
 * ПОЧЕМУ ЯВНАЯ СОРТИРОВКА, А НЕ `order by name`. База живёт с
 * collation `en_US.UTF-8`, и на кириллице это даёт порядок байтов, а не
 * алфавит. Проверено на живых данных:
 *
 *   order by name                → Ёлка · Авиация · Ель · Яблоко · авиация · 1/72
 *   order by name collate ru-RU  → 1/72 · авиация · Авиация · Ёлка · Ель · Яблоко
 *
 * В первом «Ё» впереди «А» (U+0401 < U+0410), строчные после прописных,
 * цифры после кириллицы. Это не А–Я ни в каком смысле.
 *
 * ICU-коллация `ru-RU-x-icu` есть в Postgres 15 и новее из коробки; на
 * проде их 853, локально и в CI — Postgres 16. Отдельная проверка на её
 * существование в тестах: если однажды окружение окажется без ICU,
 * пусть это будет красный тест, а не молча переставленный каталог.
 *
 * РУЧНОЙ ПОРЯДОК никуда не делся: `sort_order` остаётся в базе и
 * продолжает работать, когда выбран он. Переключение туда и обратно
 * ничего не теряет — алфавит не переписывает номера.
 */
final class CategoryOrder
{
    public const SETTING_KEY = 'categories.sort_mode';

    public const GROUP = 'catalog';

    /** По алфавиту А–Я. Умолчание. */
    public const ALPHA = 'alpha';

    /** По номеру `sort_order`, как было до C5. */
    public const MANUAL = 'manual';

    public const COLLATION = 'ru-RU-x-icu';

    /**
     * Текущий режим. Читается из базы каждый раз, без статического кеша.
     *
     * Соблазн запомнить в поле класса понятен — за запрос порядок
     * спрашивают несколько раз. Но очередь и планировщик живут часами
     * одним процессом, и запомненное значение пережило бы переключение
     * режима: задача перестроила бы дерево по устаревшему порядку. Это
     * ровно тот случай, про который в CLAUDE.md написано «модульное
     * состояние на сервере не копится между запросами». Один поиск по
     * первичному ключу дешевле такой ошибки, а публичное дерево всё
     * равно лежит в кеше целиком.
     */
    public static function mode(): string
    {
        $значение = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $режим = is_array($значение) ? ($значение['mode'] ?? null) : $значение;

        return $режим === self::MANUAL ? self::MANUAL : self::ALPHA;
    }

    public static function isAlpha(): bool
    {
        return self::mode() === self::ALPHA;
    }

    /** Сохранить выбор. Деревья кешируются — кеш сбрасывается здесь же. */
    public static function set(string $режим): string
    {
        $режим = $режим === self::MANUAL ? self::MANUAL : self::ALPHA;

        SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTING_KEY],
            ['value' => ['mode' => $режим], 'group' => self::GROUP],
        );

        CatalogService::flushCache();

        return $режим;
    }

    /**
     * Добавить порядок к запросу.
     *
     * `$колонка` — где лежит название: у направлений это `name`, у
     * обзоров `title`. Имя колонки приходит из кода, не из запроса, и
     * подставляется в SQL как есть; коллация — константа. Пользователь
     * сюда не дотягивается.
     *
     * При алфавите `sort_order` не участвует вовсе — иначе ряд с
     * номерами 10, 20, 30 остался бы в прежнем порядке, и переключатель
     * ничего бы не менял.
     *
     * @template T of EloquentBuilder|QueryBuilder
     *
     * @param  T  $query
     * @return T
     */
    public static function apply($query, string $колонка = 'name')
    {
        if (self::isAlpha()) {
            return $query->orderByRaw(sprintf('%s collate "%s"', $колонка, self::COLLATION));
        }

        return $query->orderBy('sort_order')->orderBy($колонка);
    }
}
