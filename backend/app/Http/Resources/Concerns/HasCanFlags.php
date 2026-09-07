<?php

namespace App\Http\Resources\Concerns;

use App\Models\User;

/**
 * `'can' => $this->canFlags($request->user(), ['edit' => 'update', 'delete'])`
 * — по булеву значению на действие, чтобы клиент рисовал только то, что этот
 * зритель действительно может сделать.
 */
trait HasCanFlags
{
    /**
     * Действия, которые не требуют стены `verified`: только чтение.
     *
     * Всё остальное в этом проекте лежит в группах маршрутов с middleware
     * `verified`, поэтому обещать его неподтверждённому зрителю — врать.
     */
    private const READ_ONLY_ABILITIES = ['view'];

    /**
     * @param  array<int|string, string>  $abilities  список действий или алиас => действие
     * @return array<string, bool>
     */
    protected function canFlags(?User $user, array $abilities): array
    {
        /*
         * Флаги учитывают и политику, и стену `verified`.
         *
         * Раньше здесь спрашивали только политику, а запрещал middleware на
         * группе маршрутов, о котором политика не знает. API обещал то, что
         * сам же отвергал: замер прода 07.09 — `GET /api/v1/feed` отдавал
         * учётке с неподтверждённым телефоном `can: {react: true,
         * comment: true}`, а `POST /posts/{uuid}/react` отвечал 403
         * «Подтвердите номер телефона по SMS». Клиент, доверившийся `can`,
         * рисовал живую кнопку и получал отказ.
         *
         * Стена одна и та же для обоих: `User::isFullyVerified()`.
         */
        $verified = $user?->isFullyVerified() ?? false;

        $flags = [];
        foreach ($abilities as $key => $ability) {
            $name = is_string($key) ? $key : $ability;

            if (! $user) {
                $flags[$name] = false;

                continue;
            }

            if (! $verified && ! in_array($ability, self::READ_ONLY_ABILITIES, true)) {
                $flags[$name] = false;

                continue;
            }

            $flags[$name] = $user->can($ability, $this->resource);
        }

        return $flags;
    }
}
