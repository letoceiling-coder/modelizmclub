<?php

namespace App\Console\Commands;

use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Models\Channel;
use App\Models\Community;
use App\Models\Listing;
use App\Models\Post;
use App\Models\User;
use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Перепись показательного содержимого и два действия над ним: скрыть или
 * удалить.
 *
 * Откуда оно берётся: `DatabaseSeeder` зовёт `DemoFeedSeeder`,
 * `DemoListingsSeeder`, `DemoChatSeeder`, `DemoMediaSeeder` и
 * `ChannelSeeder`. Его докблок прямо говорит, что на проде этот класс
 * звать нельзя, — но сказанного в докблоке мало: ничто не проверяет, что
 * вышло, и отличить показательную запись от настоящей на глаз нельзя.
 *
 * **Единого признака у показательных данных нет.** Это главный вывод
 * переписи 05.10, и он определяет устройство команды: у каждой таблицы
 * свой признак, и они перечислены ниже поимённо, а не угаданы по одному
 * общему полю. Флага «демо» в схеме нет ни у одной таблицы — искать его
 * бесполезно.
 *
 * | Таблица | Признак | На стенде |
 * | --- | --- | --- |
 * | `posts` | автор — `demo@` или `admin@` | 11 из 12 |
 * | `listings` | владелец — `demo@` или `admin@` | 10 из 10 |
 * | `channels` | владелец — `demo@` или `admin@` | 7 из 7 |
 * | `videos` | загрузивший — `demo@` или `admin@` | 0 из 1 |
 * | `communities` | `created_by` пуст | 2 из 2 |
 *
 * Сообщества выпадают из общего правила: семя не ставит им владельца
 * вовсе. Проверка `Community::$fillable` и правила доступа в самой модели
 * (`created_by !== null && created_by === user->id`) подтверждают, что у
 * заведённого человеком сообщества поле заполнено. Пустое `created_by` —
 * это и есть «никто не заводил», то есть семя.
 *
 * Скрытие идёт **существующим механизмом** — тем же состоянием, которым
 * пользуется модерация, а не новым полем:
 *
 * - `posts` → `ContentStatus::Hidden`;
 * - `videos` → `'hidden'` (у видео состояние строкой, публичная выборка
 *   смотрит на `status = 'published'`);
 * - `listings` → `ListingStatus::Unpublished` (значения `hidden` в этом
 *   перечислении нет);
 * - `communities` → `CommunityStatus::Draft`;
 * - `channels` → `is_active = false` (состояния у канала нет вовсе).
 *
 * Скрытие обратимо и ничего не теряет. Удаление отделено флагом и по
 * умолчанию ничего не делает: `--purge` без `--dry-run` надо запросить
 * прямо.
 */
class DemoContentCommand extends Command
{
    protected $signature = 'demo:content
        {--hide : Скрыть из публичной выдачи существующим механизмом}
        {--purge : Удалить (мягко, через deleted_at)}
        {--dry-run : Только показать, что будет сделано}';

    protected $description = 'Перепись показательного содержимого; скрытие или удаление по признакам семян';

    /** Учётки, от имени которых семена заводят содержимое. */
    private const ПОЧТА_СЕМЯН = ['demo@modelizmclub.ru', 'admin@modelizmclub.ru'];

    public function handle(): int
    {
        $скрыть = (bool) $this->option('hide');
        $удалить = (bool) $this->option('purge');
        $проба = (bool) $this->option('dry-run');

        if ($скрыть && $удалить) {
            $this->error('--hide и --purge вместе не имеют смысла: выберите одно.');

            return self::FAILURE;
        }

        $идентификаторы = User::query()
            ->whereIn('email', self::ПОЧТА_СЕМЯН)
            ->pluck('id')
            ->all();

        if ($идентификаторы === []) {
            $this->warn('Учёток семян ('.implode(', ', self::ПОЧТА_СЕМЯН).') в базе нет.');
        }

        $разделы = [
            [
                'имя' => 'posts',
                'признак' => 'автор — учётка семян',
                'запрос' => fn (): Builder => Post::query()->whereIn('user_id', $идентификаторы),
                'скрыть' => ['status' => ContentStatus::Hidden],
            ],
            [
                'имя' => 'listings',
                'признак' => 'владелец — учётка семян',
                'запрос' => fn (): Builder => Listing::query()->whereIn('user_id', $идентификаторы),
                'скрыть' => ['status' => ListingStatus::Unpublished],
            ],
            [
                'имя' => 'channels',
                'признак' => 'владелец — учётка семян',
                'запрос' => fn (): Builder => Channel::query()->whereIn('owner_id', $идентификаторы),
                'скрыть' => ['is_active' => false],
            ],
            [
                'имя' => 'videos',
                'признак' => 'загрузивший — учётка семян',
                'запрос' => fn (): Builder => Video::query()->whereIn('uploader_id', $идентификаторы),
                'скрыть' => ['status' => 'hidden'],
            ],
            [
                'имя' => 'communities',
                'признак' => 'created_by пуст — сообщество никто не заводил',
                'запрос' => fn (): Builder => Community::query()->whereNull('created_by'),
                'скрыть' => ['status' => CommunityStatus::Draft],
            ],
        ];

        $строки = [];
        $всего = 0;

        foreach ($разделы as $раздел) {
            /** @var Builder $запрос */
            $запрос = ($раздел['запрос'])();
            $сколько = (clone $запрос)->count();
            $всего += $сколько;

            $действие = '—';
            if ($сколько > 0 && ($скрыть || $удалить)) {
                $действие = $проба
                    ? ($скрыть ? 'скрыл бы' : 'удалил бы')
                    : ($скрыть ? 'скрыто' : 'удалено');

                if (! $проба) {
                    if ($скрыть) {
                        (clone $запрос)->update($раздел['скрыть']);
                    } else {
                        (clone $запрос)->delete();
                    }
                }
            }

            $строки[] = [$раздел['имя'], $сколько, $раздел['признак'], $действие];
        }

        $this->table(['Таблица', 'Строк', 'Признак', 'Действие'], $строки);

        if ($всего === 0) {
            $this->info('Показательного содержимого не найдено.');

            return self::SUCCESS;
        }

        if (! $скрыть && ! $удалить) {
            $this->info("Найдено строк: {$всего}. Это перепись; ничего не изменено.");
            $this->line('  --hide           скрыть из публичной выдачи (обратимо)');
            $this->line('  --purge --dry-run показать, что удалилось бы');

            return self::SUCCESS;
        }

        $глагол = $проба ? 'Затронуло бы' : 'Затронуто';
        $this->info("{$глагол} строк: {$всего}.");

        return self::SUCCESS;
    }
}
