<?php

namespace App\Observers;

use App\Models\Listing;
use App\Models\Post;
use App\Models\SafeDeal;
use App\Models\User;
use App\Services\RealtimeObjectUpdate;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Database\Eloquent\Model;

/**
 * Смена состояния объекта уезжает владельцу сама — одним местом на все пути.
 *
 * 21.09 живое обновление расставлялось руками: вызов в `ModerationService`,
 * вызов в `SafeDealService`. Расстановка руками закрывает ровно те пути, о
 * которых помнил автор, — а статус объявления меняют ещё семь мест:
 * оплата (`ListingService::markPublished`), продажа обычной сделкой
 * (`OrdinaryDealService`), снятие резерва, возврат на модерацию и прямая
 * правка статуса из админки (`AdminListingController`). Все они оставляли
 * экран владельца прежним, и каждое следующее место пришлось бы вспоминать
 * заново.
 *
 * Наблюдатель смотрит не на путь, а на результат: колонка `status` в строке
 * изменилась — владелец узнаёт. Новое место смены статуса попадает сюда само,
 * без правки этого файла.
 *
 * `ShouldHandleEventsAfterCommit` обязателен. Модерация, продажа и оплата
 * работают в транзакции, а `UserRealtimeEvent` вещается немедленно
 * (`ShouldBroadcastNow`): без отсрочки клиент получал бы «перечитай» раньше,
 * чем перечитывать станет что, и при откате транзакции — вообще напрасно.
 *
 * Чего наблюдатель не видит: обновления мимо модели —
 * `Model::query()->where(...)->update(...)` событий не вызывает. Такое место
 * в приложении было одно (`SafeDealService::settleListing`) и переписано на
 * сохранение модели той же веткой.
 */
class RealtimeStatusObserver implements ShouldHandleEventsAfterCommit
{
    /**
     * Статус в событии, когда объекта больше нет.
     *
     * Своего значения в перечислениях у этого нет и не надо: клиент по
     * событию перечитывает объект и получит 404 — то есть узнает правду из
     * ответа, а не из строки в событии.
     */
    private const DELETED = 'deleted';

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
            RealtimeObjectUpdate::notify($owner, $kind, $uuid, $status);
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

        if ($model instanceof SafeDeal) {
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
