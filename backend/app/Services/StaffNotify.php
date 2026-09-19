<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\InAppNotification;

/**
 * Уведомление всем действующим сотрудникам — Владельцам и Модераторам.
 *
 * До 17.09 так узнавали только о жалобах (ReportService). Обращение из «Книги
 * замечаний» и заявка на сообщество или канал сохранялись молча: сотрудник
 * видел их, только если сам открывал раздел. На проде обращения 6 и 7 от 23.08
 * и 8 от 08.09 так и стоят новыми, а заявка 9 ждала решения десять дней.
 *
 * Тип уведомления отображён в NotificationPolicyRegistry на ключ `report`:
 * Владелец выключает сигналы сотрудникам одним переключателем, как и раньше.
 */
final class StaffNotify
{
    public const LINK_MODERATION = '/admin?section=moderation';

    public const LINK_FEEDBACK = '/admin?section=feedback';

    /**
     * @param  User|null  $actor  кто вызвал событие: сотруднику незачем узнавать
     *                            о собственном обращении
     */
    public static function send(string $type, string $title, string $body, string $link, ?User $actor = null): void
    {
        User::query()
            ->whereIn('role', [UserRole::Owner, UserRole::Moderator])
            ->where('status', UserStatus::Active)
            ->when($actor !== null, fn ($q) => $q->whereKeyNot($actor->id))
            ->each(function (User $staff) use ($type, $title, $body, $link): void {
                // Обращение или заявка уже сохранены. Сбой уведомления одному
                // сотруднику не должен ни отменить их, ни оставить без сигнала
                // остальных.
                InAppNotify::sendQuiet($staff, new InAppNotification($type, $title, $body, $link));
            });
    }
}
