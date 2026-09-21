<?php

namespace App\Services;

use App\Events\UserRealtimeEvent;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * «Твой объект изменился» — личным каналом владельцу.
 *
 * Уведомление в колокольчике о смене статуса говорило человеку, что
 * решение принято, но экран перед ним оставался прежним: объявление
 * висело «на проверке», пока страницу не перезагрузят. Разведка 21.09
 * показала, что личный канал `user.{uuid}` с проверкой на сервере уже есть
 * и адресован получателю — не хватало только события о самом объекте.
 *
 * Полезная нагрузка нарочно скупая: вид, идентификатор и новый статус.
 * Содержимое объекта клиент перечитает сам — так он не покажет то, чего
 * ему видеть не положено, и не разойдётся с сервером в полях, которых в
 * событии нет.
 */
class RealtimeObjectUpdate
{
    /** Объявление. */
    public const LISTING = 'listing';

    /** Запись ленты. */
    public const POST = 'post';

    /** Безопасная сделка. */
    public const DEAL = 'deal';

    /**
     * Сообщить владельцу, что его объект сменил состояние.
     *
     * Молча глотает отказ вещания: к этому моменту действие уже случилось в
     * базе, и падение Reverb не должно превращать удачную модерацию в 500 —
     * та же причина, что у `InAppNotify::broadcastSafely`.
     */
    public static function notify(?User $owner, string $kind, string $uuid, ?string $status = null): void
    {
        if (! $owner instanceof User) {
            return;
        }

        try {
            broadcast(new UserRealtimeEvent($owner->uuid, 'object.updated', [
                'kind' => $kind,
                'uuid' => $uuid,
                'status' => $status,
            ]));
        } catch (Throwable $e) {
            /*
             * Reverb может быть недоступен — действие уже состоялось, и
             * падение вещания не должно превращать удачную модерацию в 500.
             * Но молчать совсем нельзя: живое обновление теперь единственное,
             * что держит экраны в согласии с базой, и его отказ обязан быть
             * виден в журнале. Так же поступает `InAppNotify::broadcastSafely`.
             */
            Log::warning('realtime: не удалось разослать object.updated', [
                'kind' => $kind,
                'uuid' => $uuid,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
