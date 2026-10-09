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
     * Действия, которые не требуют подтверждённой почты: только чтение.
     *
     * Всё остальное в этом проекте лежит в группах маршрутов с посредником
     * `verified.email`, поэтому обещать его неподтверждённому зрителю — врать.
     */
    private const READ_ONLY_ABILITIES = ['view'];

    /**
     * @param  array<int|string, string>  $abilities  список действий или алиас => действие
     * @return array<string, bool>
     */
    protected function canFlags(?User $user, array $abilities): array
    {
        return $this->canFlagsFor($user, $this->resource, $abilities);
    }

    /**
     * То же для объекта, который ресурс только несёт с собой: запись канала
     * отвечает за свою зеркальную запись ленты, где живут комментарии.
     *
     * @param  array<int|string, string>  $abilities
     * @return array<string, bool>
     */
    protected function canFlagsFor(?User $user, mixed $subject, array $abilities): array
    {
        /*
         * Флаги учитывают и политику, и стену, которая стоит на маршруте.
         *
         * Раньше здесь спрашивали только политику, а запрещал посредник на
         * группе маршрутов, о котором политика не знает. API обещал то, что
         * сам же отвергал: замер прода 07.09 — `GET /api/v1/feed` отдавал
         * учётке с неподтверждённым телефоном `can: {react: true,
         * comment: true}`, а `POST /posts/{uuid}/react` отвечал 403
         * «Подтвердите номер телефона по SMS». Клиент, доверившийся `can`,
         * рисовал живую кнопку и получал отказ.
         *
         * **Стена — почта, а не почта с телефоном. Решение З2 от 09.10.**
         *
         * До 09.10 здесь спрашивался `isFullyVerified()`, то есть почта И
         * телефон, — и это было верно, пока телефон требовался на всех
         * пишущих группах. Теперь телефон стоит только на публикации
         * объявления и выводе средств, а `can.*` таких действий не
         * описывает: там `react`, `comment`, `send`, `update`, `delete`,
         * `pin`, `promote`. Оставить здесь телефон значило бы повторить
         * ошибку 07.09 с другим знаком: сервер пускает, а `can` говорит
         * «нельзя», и человек без телефона не увидел бы ни кнопки лайка, ни
         * кнопки ответа — то есть ровно первую и третью жалобы владельца.
         */
        $verified = $user !== null
            && ($user->isModerator() || ! $user->requiresEmailVerification());

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

            $flags[$name] = $user->can($ability, $subject);
        }

        return $flags;
    }
}
