<?php

namespace App\Observers;

use App\Models\Listing;
use App\Models\OrdinaryDeal;
use App\Models\Post;
use App\Models\SafeDeal;
use App\Models\User;
use App\Services\RealtimeObjectUpdate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Смена состояния объекта уезжает владельцу сама — одним местом на все пути.
 *
 * 21.09 живое обновление ставилось руками: вызов в `ModerationService`,
 * вызов в `SafeDealService`. Закрывало это ровно те пути, о которых помнил
 * автор, — а статус объявления меняют ещё оплата
 * (`ListingService::markPublished`), продажа обычной сделкой, снятие
 * резерва, возврат на модерацию и прямая правка из админки
 * (`AdminListingController`). Все они оставляли экран владельца прежним, и
 * каждое следующее место пришлось бы вспоминать заново.
 *
 * Наблюдатель смотрит не на путь, а на результат: колонка `status` в строке
 * изменилась — владелец узнаёт. Новое место смены статуса попадает сюда само,
 * без правки этого файла.
 *
 * Чего наблюдатель не видит: обновления мимо модели —
 * `Model::query()->where(...)->update(...)` событий не вызывает. Таких мест
 * сплошным поиском 22.09 нашлось два. `SafeDealService::settleListing`
 * переписан на сохранение модели. `PostService::returnToDraftsForSubscription`
 * оставлен условным обновлением нарочно — оно же защита от гонки с автором —
 * и зовёт рассылку сам; это единственное исключение, и оно названо там же.
 *
 * Сознательно вне охвата: записи канала, видео и сообщества. Их статусы
 * модерация тоже меняет, но отдельного экрана «моё, на проверке» у них нет —
 * решение приходит колокольчиком, и слать событие было бы некому. Это
 * решение, а не забывчивость; появится экран — добавится модель.
 */
class RealtimeStatusObserver
{
    /**
     * Статус в событии, когда объекта больше нет.
     *
     * Своего значения в перечислениях у этого нет и не надо: клиент по
     * событию перечитывает объект и получит 404 — то есть узнает правду из
     * ответа, а не из строки в событии.
     */
    private const DELETED = 'deleted';

    /**
     * Решение принимается здесь и сейчас, а отправка откладывается до
     * фиксации.
     *
     * Готовый `ShouldHandleEventsAfterCommit` на наблюдателе для этого не
     * годится, и это не вкусовщина. Он откладывает **весь** вызов вместе с
     * тем же объектом модели, а `Model::performUpdate` на каждом сохранении
     * перезаписывает набор изменений (`syncChanges`). Значит при двух
     * сохранениях одной модели в одной транзакции — а так работают правка
     * объявления владельцем, публикация записи и разбор платежа — оба
     * отложенных вызова увидели бы изменения **последнего** сохранения:
     * при порядке «без статуса, потом со статусом» владелец получал бы два
     * одинаковых события, а при обратном порядке — ни одного, молча.
     */
    public function updated(Model $model): void
    {
        if (! $model->wasChanged('status')) {
            return;
        }

        $this->announce($model, $this->statusOf($model));
    }

    /**
     * Удаление — тоже изменение, которое человек должен увидеть.
     *
     * Админка сносит чужое объявление или запись; до этой ветки список
     * владельца показывал её до перезагрузки страницы.
     */
    public function deleted(Model $model): void
    {
        $this->announce($model, self::DELETED);
    }

    /**
     * Восстановление отменяет `deleted`.
     *
     * Само по себе оно меняет только `deleted_at`, то есть `updated` его не
     * заметит. Без этого экран, которому уже сказали «удалено», остался бы
     * на «не найдено» до перезагрузки.
     */
    public function restored(Model $model): void
    {
        $this->announce($model, $this->statusOf($model));
    }

    private function announce(Model $model, ?string $status): void
    {
        $subject = $this->subject($model);
        if ($subject === null) {
            return;
        }

        [$kind, $owners] = $subject;
        $uuid = $model->getAttribute('uuid');
        if (! is_string($uuid) || $uuid === '') {
            return;
        }

        $sent = [];
        foreach ($owners as $owner) {
            if (! $owner instanceof User || in_array($owner->uuid, $sent, true)) {
                continue;
            }
            $sent[] = $owner->uuid;

            /*
             * После фиксации: `UserRealtimeEvent` вещается немедленно
             * (`ShouldBroadcastNow`), и без отсрочки клиент получал бы
             * «перечитай» раньше, чем перечитывать станет что, а при откате
             * транзакции — вообще напрасно. Вне транзакции замыкание
             * выполняется сразу же.
             */
            DB::afterCommit(static function () use ($owner, $kind, $uuid, $status): void {
                RealtimeObjectUpdate::notify($owner, $kind, $uuid, $status);
            });
        }
    }

    /**
     * Вид объекта и те, кому его состояние принадлежит.
     *
     * У сделки таких двое: шаг меняет одна сторона, а видеть его должны обе —
     * именно ради второй стороны всё и затевалось.
     *
     * @return array{0: string, 1: list<?User>}|null
     */
    private function subject(Model $model): ?array
    {
        if ($model instanceof Listing) {
            return [RealtimeObjectUpdate::LISTING, [$model->author]];
        }

        if ($model instanceof Post) {
            return [RealtimeObjectUpdate::POST, [$model->author]];
        }

        /*
         * Обычная сделка — тот же вид, что безопасная: раздел «Сделки»
         * показывает их вперемешку, и экран не различает, чей шаг сменился.
         * Идентификаторы у них разные, так что страница одной сделки чужое
         * событие отбросит сама.
         */
        if ($model instanceof SafeDeal || $model instanceof OrdinaryDeal) {
            return [RealtimeObjectUpdate::DEAL, [$model->buyer, $model->seller]];
        }

        return null;
    }

    private function statusOf(Model $model): ?string
    {
        $status = $model->getAttribute('status');

        if ($status instanceof \BackedEnum) {
            return (string) $status->value;
        }

        return is_string($status) ? $status : null;
    }
}
