<?php

namespace App\Support\Demo;

use App\Models\User;
use App\Support\DemoImageFactory;
use App\Models\Media;
use Modules\Media\Services\MediaUploadService;

/**
 * Раздел демо-набора: умеет рассказать, что создаст, и создать это.
 *
 * ДВА МЕТОДА, А НЕ ОДИН. `plan()` обязан отвечать без единой записи в базу —
 * на нём держится `--dry-run`, который заказчик смотрит до создания. Поэтому
 * пересчёт «сколько уже есть» идёт запросами на чтение, а не попыткой создать
 * и откатить: откат в транзакции не виден в отчёте и не ловит нехватку прав.
 *
 * ПОРЦИЯМИ. `create()` зовёт `$tick` после каждой созданной единицы. Команда
 * на этом делает паузы и считает время: демо-набор трогает конвейер медиа, а
 * тот на каждую картинку собирает четыре размера в трёх форматах. Разом это
 * кладёт процессор сервера, на котором живут настоящие люди.
 */
abstract class DemoSection
{
    /** Домен-пометка. Один на весь набор: по нему всё находится и удаляется. */
    public const EMAIL_DOMAIN = 'demo.modelizmclub.ru';

    /** Первая строка любого демо-текста: человек должен видеть, что это витрина. */
    public const MARKER = 'Демонстрационная запись клуба.';

    abstract public function key(): string;

    abstract public function title(): string;

    /**
     * Что будет создано. Только чтение.
     *
     * @return array{rows: list<array<int, string|int>>, create: int, exists: int}
     */
    abstract public function plan(): array;

    /**
     * Создать недостающее. Возвращает, сколько создано.
     *
     * @param  callable(string): void  $tick  зовётся после каждой единицы
     */
    abstract public function create(callable $tick): int;

    /** Заголовки колонок отчёта. @return list<string> */
    abstract public function columns(): array;

    /**
     * Чего раздел не сможет сделать и почему.
     *
     * Нужен, потому что часть набора зависит от того, что уже есть на сервере:
     * тарифы, учётная запись администратора, ffmpeg. Без них раздел не падает,
     * а делает меньше — и это обязано быть видно в отчёте, иначе «подписчиков
     * нет» выглядит как дефект сайта, а не как пропущенный кусок набора.
     *
     * @return list<string>
     */
    public function warnings(): array
    {
        return [];
    }

    /** @var array<string, User>|null */
    private ?array $peopleCache = null;

    /**
     * Демо-люди по локальной части адреса.
     *
     * Кеш — на экземпляр раздела, а не на класс: разделы идут по порядку, и
     * тот, что после создания людей, обязан увидеть новых.
     *
     * @return array<string, User>
     */
    protected function people(): array
    {
        if ($this->peopleCache !== null) {
            return $this->peopleCache;
        }

        $cache = [];
        foreach (User::query()->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->with('profile')->get() as $user) {
            $cache[explode('@', (string) $user->email)[0]] = $user;
        }

        return $this->peopleCache = $cache;
    }

    /**
     * Псевдослучайное, но воспроизводимое число: один и тот же посев даёт один
     * и тот же набор. Иначе повторный прогон после `--purge` создаёт другую
     * картину, и «не воспроизвелось» невозможно отличить от «починилось».
     */
    protected function rand(string $seed, int $min, int $max): int
    {
        $hash = crc32($seed);

        return $min + ($hash % max(1, $max - $min + 1));
    }

    /** Картинка-заглушка через обычный конвейер медиа. */
    protected function image(User $owner, MediaUploadService $uploads, string $label, string $purpose): Media
    {
        return DemoImageFactory::upload($owner, $uploads, $label, $purpose);
    }
}
