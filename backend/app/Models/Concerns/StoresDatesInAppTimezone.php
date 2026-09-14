<?php

namespace App\Models\Concerns;

use Illuminate\Support\Carbon;

/**
 * Время пишется в базу в поясе приложения, откуда бы ни пришло.
 *
 * Колонки времени — timestamp без пояса, прод живёт по Europe/Moscow.
 * Eloquent форматирует дату в стенные часы её собственного пояса: строка
 * «…T20:59:59Z» с формы или Carbon в UTC ложились в базу как «20:59:59»
 * и читались как 20:59 по Москве — на три часа раньше выбранного.
 * Так 14.09 уехало время мероприятий, так же истекали промо-пулы «на N
 * месяцев».
 *
 * Трейт переопределяет запись для всех date-колонок модели: время
 * приводится к поясу приложения и пишется со смещением («…23:59:59+03:00»).
 * Смещение нужно не для timestamp без пояса — там Postgres его молча
 * отбрасывает и оставляет стенные часы, — а для timestamptz (promo_pools,
 * referrals.completed_at): без смещения строку трактует пояс сессии, а он
 * у прода Etc/UTC, у локальной базы — какой угодно. Строки без пояса с
 * формы («2026-12-31 23:59:59») читаются как время приложения.
 */
trait StoresDatesInAppTimezone
{
    /**
     * @param  mixed  $value
     * @return string|null
     */
    public function fromDateTime($value)
    {
        return empty($value) ? $value : $this->asDateTime($value)
            ->setTimezone((string) config('app.timezone'))
            ->format($this->getDateFormat().'P');
    }

    /**
     * В JSON — тоже в поясе приложения, со смещением («…T23:59:59+03:00»).
     *
     * По умолчанию Eloquent отдаёт `toArray()`/`paginate()` в UTC («…Z»), и
     * интерфейс, берущий дату как `slice(0, 10)`, показывал предыдущий день:
     * промокод «до 31.12» в таблице админки стоял «до 30.12». Мгновение то же,
     * меняется только запись.
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return Carbon::instance($date)
            ->setTimezone((string) config('app.timezone'))
            ->toIso8601String();
    }
}
